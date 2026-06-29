const express = require("express");
const router = express.Router();
const supabase = require("../lib/supabase");
const { adminAuth } = require("../middleware/auth");

// Fallback Stripe initialization for standard operations
const defaultStripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

/**
 * Helper function to retrieve dynamic tenant Stripe credentials from the database.
 * Falls back safely to global application environment variables if blank.
 */
async function getDynamicStripeClient(tenantId) {
    try {
        const { data: settings, error } = await supabase
            .from("tenant_settings")
            .select("stripe_secret_key")
            .eq("tenant_id", tenantId)
            .maybeSingle();

        if (!error && settings && settings.stripe_secret_key) {
            return require("stripe")(settings.stripe_secret_key);
        }
    } catch (err) {
        console.error("⚠️ Error fetching dynamic tenant Stripe config, falling back:", err);
    }
    return defaultStripe;
}

// ==========================================
// 1. PUBLIC ENDPOINTS: AVAILABILITY & BOOKING
// ==========================================

// GET: Fetch available slots for a specific date (filtering out booked appointments)
router.get("/api/availability", async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ error: "date is required." });

        const allSlots = ["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"];

        const { data, error } = await supabase
            .from("appointments")
            .select("time")
            .eq("tenant_id", req.tenant.id)
            .eq("date", date)
            .neq("status", "cancelled");

        if (error) return res.status(500).json({ error: error.message });

        const bookedTimes = data.map(a => a.time);
        const available = allSlots.filter(slot => !bookedTimes.includes(slot));
        
        return res.json({ available });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST: Generate Stripe checkout sessions using dynamically resolved key scopes
router.post("/api/appointments", async (req, res) => {
    try {
        const { service_id, guest_name, email, phone, date, time, notes } = req.body;
        if (!service_id || !guest_name || !email || !date || !time) {
            return res.status(400).json({ error: "service_id, guest_name, email, date, and time are required." });
        }

        // Fetch service price and metadata scoped safely to the active routing tenant context
        const { data: service, error: serviceError } = await supabase
            .from("services")
            .select("name, price")
            .eq("id", service_id)
            .eq("tenant_id", req.tenant.id)
            .single();

        if (serviceError || !service) return res.status(404).json({ error: "Service not found." });

        // Resolve the dynamic Stripe instance assigned to this specific business profile
        const activeStripe = await getDynamicStripeClient(req.tenant.id);

        const origin = `${req.protocol}://${req.get("host")}`;
        const session = await activeStripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [{
                price_data: {
                    currency: "usd",
                    product_data: { 
                        name: service.name, 
                        description: `${date} at ${time}` 
                    },
                    unit_amount: Math.round(parseFloat(service.price) * 100)
                },
                quantity: 1
            }],
            mode: "payment",
            customer_email: email,
            success_url: `${origin}/appointments.html?success=true`,
            cancel_url: `${origin}/appointments.html`,
            metadata: { 
                tenant_id: req.tenant.id, 
                service_id, 
                guest_name, 
                email, 
                phone: phone || "", 
                date, 
                time, 
                notes: notes || "" 
            }
        });

        return res.json({ url: session.url });
    } catch (err) {
        console.error("❌ Checkout session setup failed:", err);
        return res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 2. ADMIN ENDPOINTS: DASHBOARD HOOKS
// ==========================================

// GET: Fetch all active appointments for the admin data grid display
router.get("/api/appointments", adminAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("appointments")
            .select("*")
            .eq("tenant_id", req.tenant.id)
            .order("date");

        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

const VALID_STATUSES = ["confirmed", "cancelled", "completed"];

// PATCH: Update administrative booking matrix markers
router.patch("/api/appointments/:id/status", adminAuth, async (req, res) => {
    try {
        const { status } = req.body;
        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({ error: "Invalid status." });
        }

        const { error } = await supabase
            .from("appointments")
            .update({ status })
            .eq("id", req.params.id)
            .eq("tenant_id", req.tenant.id);

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;