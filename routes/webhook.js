const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const supabase = require("../lib/supabase");
const { sendEmail, emailTemplate } = require("../lib/email");

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// 🎯 CHANGED PATH: Standardized to "/api/webhooks/stripe"
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
            status: "confirmed", // Mark as paid/confirmed immediately
            payment_intent_id: session.payment_intent
        }]);

        if (error) {
            console.error("❌ Supabase Insertion Failure Error:", error);
            return res.status(500).json({ error: "Database error" });
        }

        console.log("🎯 Database write complete! Sending client confirmation email...");

        // ✉️ SEND EMAIL
        try {
            await sendEmail(m.email, "Your appointment is confirmed!",
                emailTemplate("Appointment Confirmed", `
                    <p>Hi ${escapeHtml(m.guest_name)},</p>
                    <p>Your appointment has been booked for <strong>${m.date} at ${m.time}</strong>.</p>
                    <p>If you need to cancel or reschedule, please contact us.</p>
                `, { name: "The Wellness Co" })
            );
            console.log("✅ Confirmation email sent successfully!");
        } catch (emailErr) {
            console.error("⚠️ Webhook succeeded, but confirmation email failed to fire:", emailErr);
        }
    }

    res.json({ received: true });
});

module.exports = router;