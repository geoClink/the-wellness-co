const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const supabase = require("../lib/supabase");

// 🌟 IMPORT YOUR NEW DYNAMIC EMAIL UTILITY
const { sendDynamicTenantEmail } = require("../utils/email");

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    console.log("📥 Incoming webhook ping detected from Stripe...");

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`❌ Webhook Signature Error: ${err.message}`);
        return res.status(400).send(`Webhook error: ${err.message}`);
    }

    console.log(`🔔 Stripe Event Authenticated: ${event.type}`);

    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const m = session.metadata;

        console.log("📦 Extracting session metadata:", m);

        // 🛡️ Idempotency check: Make sure this exact transaction isn't already logged
        const { data: existing, error: checkError } = await supabase
            .from("appointments")
            .select("id")
            .eq("payment_intent_id", session.payment_intent)
            .maybeSingle();

        if (checkError) {
            console.error("❌ Supabase look-up check error:", checkError);
        }

        if (existing) {
            console.log("⚠️ Appointment already exists for this payment intent. Skipping insert.");
            return res.json({ received: true });
        }

        // 🚀 WRITE TO SUPABASE: Commit the paid entry row
        console.log(`✍️ Inserting booking into database for client: ${m.guest_name}`);
        const { error } = await supabase.from("appointments").insert([{
            tenant_id: m.tenant_id,
            service_id: m.service_id,
            guest_name: m.guest_name,
            email: m.email,
            phone: m.phone || null,
            date: m.date,
            time: m.time,
            notes: m.notes || "",
            status: "confirmed", 
            payment_intent_id: session.payment_intent
        }]);

        if (error) {
            console.error("❌ Supabase Insertion Failure Error:", error);
            return res.status(500).json({ error: "Database error" });
        }

        console.log("🎯 Database write complete! Sending dynamic notification confirmation email...");

        // ✉️ DYNAMIC WHITE-LABEL RESEND NOTIFICATION DELIVERY
        try {
            await sendDynamicTenantEmail(m.tenant_id, {
                to: m.email,
                subject: "Your appointment is confirmed!",
                html: `
                    <div style="font-family: sans-serif; color: #2c2823; max-width: 600px; padding: 20px;">
                        <h3>Hi ${escapeHtml(m.guest_name)},</h3>
                        <p>Your appointment has been successfully booked and confirmed!</p>
                        <hr style="border: 0; border-top: 1px solid #e6dcc9; margin: 20px 0;">
                        <p><strong>Session Date:</strong> ${escapeHtml(m.date)}</p>
                        <p><strong>Arrival Time:</strong> ${escapeHtml(m.time)}</p>
                        <hr style="border: 0; border-top: 1px solid #e6dcc9; margin: 20px 0;">
                        <p style="font-size: 14px; color: #6f665a;">Thank you for booking with us. If you need to cancel or reschedule, please contact your practitioner directly.</p>
                    </div>
                `
            });
            console.log("✅ Dynamic confirmation email processed cleanly!");
        } catch (emailErr) {
            console.error("⚠️ Webhook database updated, but dynamic email delivery failed:", emailErr);
        }
    }

    res.json({ received: true });
});

module.exports = router;