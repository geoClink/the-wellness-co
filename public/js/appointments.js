const express = require("express");
const router = express.Router();
const supabase = require("../lib/supabase");
const Stripe = require("stripe");

router.post("/api/appointments", async (req, res) => {
    try {
        const { serviceId, date, time, guestName, email, phone, notes } = req.body;
        const tenantId = req.tenant.id; // Resolved securely by your global middleware

        // 1. Fetch this tenant's payment gateway records from Supabase
        const { data: settings } = await supabase
            .from("tenant_settings")
            .select("stripe_secret_key")
            .eq("tenant_id", tenantId)
            .maybeSingle();

        // 🌟 CRITICAL FIX: Use the tenant's live key, OR fall back safely to your environment variable key
        const activeStripeKey = (settings && settings.stripe_secret_key) 
            ? settings.stripe_secret_key 
            : process.env.STRIPE_SECRET_KEY;

        if (!activeStripeKey) {
            console.error("❌ Stripe initiation failed: No secret token resolved.");
            return res.status(500).json({ error: "Payment gateway misconfigured." });
        }

        // Initialize Stripe dynamically scoped to this validated key token
        const stripe = new Stripe(activeStripeKey);

        // 2. Build the explicit checkout session configuration payload
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            line_items: [{
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: "Wellness Session Reservation Balance",
                        description: `Appointment Scheduled for ${date} at ${time}`,
                    },
                    unit_amount: 11000, // $110.00 base balance rate (or match dynamic pricing)
                },
                quantity: 1,
            }],
            // 🌟 CRITICAL METADATA: Handing parameters down to your working webhook handler
            metadata: {
                tenant_id: tenantId,
                service_id: serviceId,
                guest_name: guestName,
                email: email,
                phone: phone || "",
                date: date,
                time: time,
                notes: notes || ""
            },
            success_url: `${req.protocol}://${req.get("host")}/confirmation.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.protocol}://${req.get("host")}/appointments.html`,
        });

        // 🌟 FIX: Return the JSON object containing the URL instead of a raw text success payload!
        return res.json({ id: session.id, url: session.url });

    } catch (err) {
        console.error("❌ Appointment reservation checkout initiation exploded:", err);
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;