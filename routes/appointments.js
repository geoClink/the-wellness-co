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

// GET: Fetch available slots for a specific date
router.get("/api/availability", async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ error: "date is required." });

        const allSlots = ["09:00 AM", "11:30 AM", "02:00 PM", "04:30 PM"];

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
        // 🌟 DUAL CASING FALLBACK EXTRACTOR
        const { 
            serviceId, service_id, 
            guestName, guest_name, 
            email, phone, date, time, notes 
        } = req.body;

        const finalServiceId = serviceId || service_id;
        const finalGuestName = guestName || guest_name;

        if (!finalServiceId || !finalGuestName || !email || !date || !time) {
            return res.status(400).json({ error: "Service, Full name, Email, Date, and Time slots are required." });
        }

        // Fetch service price and metadata safely from database
        const { data: service, error: serviceError } = await supabase
            .from("services")
            .select("name, price")
            .eq("id", finalServiceId)
            .eq("tenant_id", req.tenant.id)
            .single();

        if (serviceError || !service) return res.status(404).json({ error: "Chosen service profile not found." });

        // Resolve the dynamic Stripe instance
        const activeStripe = await getDynamicStripeClient(req.tenant.id);

        // Enforce secure redirection link resolution mapping
        const origin = process.env.NODE_ENV === 'production' 
            ? `https://${req.get("host")}` 
            : `${req.protocol}://${req.get("host")}`;

        const session = await activeStripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [{
                price_data: {
                    currency: "usd",
                    product_data: { 
                        name: service.name, 
                        description: `${date} at ${time}` 
                    },
                    // Converts price dynamically out of database scale safely to cents
                    unit_amount: Math.round(parseFloat(service.price) * 100)
                },
                quantity: 1
            }],
            mode: "payment",
            customer_email: email,
            success_url: `${origin}/confirmation.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/appointments.html`,
            metadata: { 
                tenant_id: req.tenant.id, 
                service_id: finalServiceId, 
                guest_name: finalGuestName, 
                email, 
                phone: phone || "", 
                date, 
                time, 
                notes: notes || "" 
            }
        });

        return res.json({ id: session.id, url: session.url });
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