const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const supabase = require("../lib/supabase");
const { adminAuth } = require("../middleware/auth");

router.get("/api/availability", async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "date is required." });

    const allSlots = ["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"];

    const { data, error } = await supabase.from("appointments")
        .select("time")
        .eq("tenant_id", req.tenant.id)
        .eq("date", date)
        .neq("status", "cancelled");
    if (error) return res.status(500).json({ error: error.message });

    const bookedTimes = data.map(a => a.time);
    const available = allSlots.filter(slot => !bookedTimes.includes(slot));
    res.json({ available });
});

router.post("/api/appointments", async (req, res) => {
    const { service_id, guest_name, email, phone, date, time, notes } = req.body;
    if (!service_id || !guest_name || !email || !date || !time) {
        return res.status(400).json({ error: "service_id, guest_name, email, date, and time are required." });
    }

    const { data: service, error: serviceError } = await supabase.from("services")
        .select("name, price").eq("id", service_id).eq("tenant_id", req.tenant.id).single();
    if (serviceError || !service) return res.status(404).json({ error: "Service not found." });

    const origin = `${req.protocol}://${req.get("host")}`;
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
            price_data: {
                currency: "usd",
                product_data: { name: service.name, description: `${date} at ${time}` },
                unit_amount: Math.round(service.price * 100)
            },
            quantity: 1
        }],
        mode: "payment",
        customer_email: email,
        success_url: `${origin}/confirmation.html`,
        cancel_url: `${origin}/booking.html`,
        metadata: { tenant_id: req.tenant.id, service_id, guest_name, email, phone: phone || "", date, time, notes: notes || "" }
    });

    res.json({ url: session.url });
});

router.get("/api/appointments", adminAuth, async (req, res) => {
    const { data, error } = await supabase.from("appointments")
        .select("*")
        .eq("tenant_id", req.tenant.id)
        .order("date");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.patch("/api/appointments/:id/status", adminAuth, async (req, res) => {
    const { status } = req.body;
    const { error } = await supabase.from("appointments")
        .update({ status })
        .eq("id", req.params.id)
        .eq("tenant_id", req.tenant.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

module.exports = router;
