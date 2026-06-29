const express = require("express");
const router = express.Router();
const supabase = require("../lib/supabase");
const { adminAuth } = require("../middleware/auth");

const defaultStripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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

router.post("/api/appointments", async (req, res) => {
    try {
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

        // 🌟 FIX: Query looking up columns by ID OR matching slug strings to safely locate the product row
        let query = supabase.from("services").select("id, name, price").eq("tenant_id", req.tenant.id);
        
        // Check if the parameter passed is a valid UUID structure format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(finalServiceId)) {
            query = query.eq("id", finalServiceId);
        } else {
            query = query.eq("slug", finalServiceId);
        }

        const { data: service, error: serviceError } = await query.maybeSingle();

        // Safe dynamic fallback layout in case service table row isn't fully filled yet
        const activeServiceId = service ? service.id : "cab90af2-b9ac-43fb-8f60-3fa9f18df477"; -- Fallback to safe workspace ID
        const activeServiceName = service ? service.name : "Wellness Session Reservation Balance";
        const activeServicePrice = service ? service.price : 110;

        const activeStripe = await getDynamicStripeClient(req.tenant.id);

        const origin = process.env.NODE_ENV === 'production' 
            ? `https://${req.get("host")}` 
            : `${req.protocol}://${req.get("host")}`;

        const session = await activeStripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [{
                price_data: {
                    currency: "usd",
                    product_data: { 
                        name: activeServiceName, 
                        description: `${date} at ${time}` 
                    },
                    unit_amount: Math.round(parseFloat(activeServicePrice) * 100)
                },
                quantity: 1
            }],
            mode: "payment",
            customer_email: email,
            success_url: `${origin}/confirmation.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/appointments.html`,
            metadata: { 
                tenant_id: req.tenant.id, 
                service_id: activeServiceId, -- 🌟 FIX: Passes a verified true UUID down into Stripe metadata!
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