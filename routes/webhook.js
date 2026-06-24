const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const supabase = require("../lib/supabase");
const { sendEmail, emailTemplate } = require("../lib/email");

router.post("/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const m = session.metadata;

        const { data: existing } = await supabase
            .from("appointments")
            .select("id")
            .eq("payment_intent_id", session.payment_intent)
            .maybeSingle();
        if (existing) return res.json({ received: true });

        const { error } = await supabase.from("appointments").insert([{
            tenant_id: m.tenant_id,
            service_id: m.service_id,
            guest_name: m.guest_name,
            email: m.email,
            phone: m.phone,
            date: m.date,
            time: m.time,
            notes: m.notes,
            status: "confirmed",
            payment_intent_id: session.payment_intent
        }]);

        if (error) {
            console.error("Supabase insert error:", error);
        } else {
            await sendEmail(m.email, "Your appointment is confirmed!",
                emailTemplate("Appointment Confirmed", `
                    <p>Hi ${m.guest_name},</p>
                    <p>Your appointment has been booked for <strong>${m.date} at ${m.time}</strong>.</p>
                    <p>If you need to cancel or reschedule, please contact us.</p>
                `, { name: "The Wellness Co" })
            );
        }
    }

    res.json({ received: true });
});

module.exports = router;
