const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const supabase = require("../lib/supabase");
const { emailTemplate } = require('../lib/email');

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

        // 🛑 CRITICAL INTEGRATION CHECK: Prevent crashes if an item lacked explicit properties setup
        if (!m || !m.tenant_id || !m.guest_name) {
            console.warn("⚠️ Webhook event abandoned: Stripe metadata payload container missing properties:", m);
            return res.json({ received: true, warning: "Empty metadata properties payload bundle ignored." });
        }

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

        // 🚀 WRITE TO SUPABASE: Commit the paid entry row safely
        console.log(`✍️ Inserting booking into database for client: ${m.guest_name}`);
        const { data: newAppt, error } = await supabase.from("appointments").insert([{
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
        }]).select().single();

        if (error) {
            console.error("❌ Supabase Insertion Failure Error:", error);
            return res.status(500).json({ error: "Database error" });
        }

        console.log("🎯 Database write complete! Attempting confirmation mail delivery flow...");

        // ✉️ SAFE WHITE-LABEL EMAIL UTILITY PROCESSING WINDOW
        try {
            // Requiring dynamically inside code logic prevents root compilation crashes if file structure changes
            const emailUtils = require("../utils/email");
            const bodyHtml = `
                <p>Hi ${escapeHtml(m.guest_name)},</p>
                <p>Your appointment has been successfully booked and confirmed!</p>
                <hr style="border: 0; border-top: 1px solid #e6dcc9; margin: 20px 0;">
                <p><strong>Session Date:</strong> ${escapeHtml(m.date)}</p>
                <p><strong>Arrival Time:</strong> ${escapeHtml(m.time)}</p>
                <hr style="border: 0; border-top: 1px solid #e6dcc9; margin: 20px 0;">
                <p style="font-size: 14px; color: #6f665a;">Thank you for booking with us.</p>
                <p style="margin-top: 16px; font-size: 14px;">Need to cancel? <a href="${req.protocol}://${req.get('host')}/cancel.html?token=${newAppt.cancel_token}" style="color: #b5713f;">Cancel this appointment</a></p>
            `;
            await emailUtils.sendDynamicTenantEmail(m.tenant_id, {
                to: m.email,
                subject: "Your appointment is confirmed!",
                html: emailTemplate('Your appointment is confirmed!', bodyHtml)
            });
            console.log("✅ Dynamic confirmation email processed cleanly!");
        } catch (emailErr) {
            console.error("⚠️ Webhook database updated, but dynamic email delivery engine failed gracefully:", emailErr.message);
        }
    }

    res.json({ received: true });
});

module.exports = router;