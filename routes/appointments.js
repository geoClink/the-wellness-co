const express = require("express");
const router = require("express").Router();
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
        const duration = parseInt(req.query.duration) || 60;
        if (duration <= 0 || duration > 480) return res.status(400).json({ error: "Invalid duration." })
        if (!date) return res.status(400).json({ error: "date is required." });

        const dayOfWeek = new Date(date + 'T12:00:00').getDay();

        const { data: rule } = await supabase
            .from("availability_rules")
            .select("is_active, start_time, end_time, break_start, break_end")
            .eq("tenant_id", req.tenant.id)
            .eq("day_of_week", dayOfWeek)
            .maybeSingle();

        if (!rule || !rule.is_active) {
            return res.json({ available: [] });
        }

        const { data: blocked } = await supabase
            .from("blocked_dates")
            .select("id")
            .eq("tenant_id", req.tenant.id)
            .eq("date", date)
            .maybeSingle();

        if (blocked) return res.json({ available: [] });

        const toMinutes = (timeStr) => {
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };
        const toLabel = (minutes) => {
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            const ampm = h >= 12 ? 'PM' : 'AM';
            const displayH = h % 12 === 0 ? 12 : h % 12;
            return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
        };

        const startMins = toMinutes(rule.start_time);
        const endMins = toMinutes(rule.end_time);
        const allSlotMins = [];

        for (let t = startMins; t + duration <= endMins; t += duration) {
            allSlotMins.push(t);
        }

        const { data: booked } = await supabase
            .from("appointments")
            .select("time, services(duration_minutes)")
            .eq("tenant_id", req.tenant.id)
            .eq("date", date)
            .neq("status", "cancelled");

        const available = allSlotMins.filter(slotMins => {
            if (rule.break_start && rule.break_end) {
                const breakStartMins = toMinutes(rule.break_start);
                const breakEndMins = toMinutes(rule.break_end);
                const overlapsBreak = slotMins < breakEndMins && slotMins + duration > breakStartMins;
                if (overlapsBreak) return false;
            }

            return !(booked || []).some(b => {
                const bookedMins = (() => {
    const isPM = b.time.includes('PM');
    const isAM = b.time.includes('AM');
    const [h, m] = b.time.replace(' AM', '').replace(' PM', '').split(':').map(Number);
    let hour = h;
    if (isPM && h !== 12) hour += 12;
    if (isAM && h === 12) hour = 0;
    return hour * 60 + m;
})();
                const bookedDuration = b.services?.duration_minutes || 60;
                return slotMins < bookedMins + bookedDuration && bookedMins < slotMins + duration;
            });
        }).map(toLabel);

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

        // Query looking up columns by ID OR matching slug strings to safely locate the product row
        let query = supabase.from("services").select("id, name, price").eq("tenant_id", req.tenant.id);

        // Check if the parameter passed is a valid UUID structure format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(finalServiceId)) {
            query = query.eq("id", finalServiceId);
        } else {
            query = query.eq("slug", finalServiceId);
        }

        const { data: service, error: serviceError } = await query.maybeSingle();

        
        if (!service) {
            return res.status(400).json({ error: "Service not found." });
        }

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
                        name: service.name,
                        description: `${date} at ${time}`
                    },
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
                service_id: service.id,
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