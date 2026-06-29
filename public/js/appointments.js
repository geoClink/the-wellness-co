const express = require("express");
const router = express.Router();
const supabase = require("../lib/supabase");
const { adminAuth } = require("../middleware/auth");

// Instantiate Stripe safely using your secure private environment variables
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// ==========================================
// 1. PUBLIC ENDPOINT: INITIAL BOOKING FLOW
// ==========================================
router.post("/api/appointments", async (req, res) => {
    try {
        const { service_id, guest_name, email, phone, date, time, notes } = req.body;

        // 1. Structural Parameter Sanity Validation
        if (!service_id || !guest_name || !email || !date || !time) {
            return res.status(400).json({ error: "Required scheduling parameters are missing." });
        }

        // 2. Fetch the corresponding service from Supabase to grab the real, secure price
        const { data: service, error: sError } = await supabase
            .from("services")
            .select("*")
            .eq("id", service_id)
            .maybeSingle();

        if (sError || !service) {
            return res.status(404).json({ error: "The requested healing modality could not be found." });
        }

        // 3. GENERATE STRIPE CHECKOUT SESSION
        // We pass the booking variables into metadata so the Stripe Webhook can read them on payment success
        // 🎯 UPDATE THIS inside routes/appointments.js:
const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
        {
            price_data: {
                currency: 'usd',
                product_data: {
                    name: serviceName, // Fetch this from your service profile
                },
                unit_amount: servicePrice * 100, // Stripe expects amounts in cents
            },
            quantity: 1,
        },
    ],
    mode: 'payment',
    
    // 🌟 THIS IS THE CRITICAL MISSING BLOCK:
    metadata: {
        tenant_id: req.tenant?.id || "the-wellness-co", // Match your middleware lookup strategy
        service_id: req.body.service_id,
        guest_name: req.body.guest_name,
        email: req.body.email,
        phone: req.body.phone,
        date: req.body.date,
        time: req.body.time,
        notes: req.body.notes
    },
    
    success_url: 'https://the-wellness-co.vercel.app/appointments.html?success=true',
    cancel_url: 'https://the-wellness-co.vercel.app/appointments.html',
});

res.json({ url: session.url });

// ==========================================
// 2. ADMIN ENDPOINTS: DASHBOARD HUB INTERFACE
// ==========================================

// GET: Fetch all active appointments for the admin data grid table display
router.get("/api/appointments", adminAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("appointments")
            .select("*")
            .eq("tenant_id", req.tenant.id)
            .order("date", { ascending: true });

        if (error) return res.status(500).json({ error: error.message });
        return res.json(data || []);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// PATCH: Update booking status matrices (Confirm / Cancel actions)
router.专修("/api/appointments/:id/status", adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const { data, error } = await supabase
            .from("appointments")
            .update({ status })
            .eq("id", id)
            .eq("tenant_id", req.tenant.id)
            .select();

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;