const express = require("express");
const router = express.Router();
const supabase = require("../lib/supabase");
const { adminAuth } = require("../middleware/auth");

// ==========================================
// 1. CORE SITE & HERO SETTINGS ENDPOINTS
// ==========================================

// Fetch ALL Site Settings Profile Metrics
router.get("/api/site-settings", async (req, res) => {
    try {
        const { data, error } = await supabase.from("site_settings").select("*")
            .eq("tenant_id", req.tenant.id).maybeSingle();
        if (error) return res.status(500).json({ error: error.message });
        res.json(data ?? {});
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Comprehensive Patch Route (Handles Hero Updates + Banners + General Hours)
router.patch("/api/site-settings", adminAuth, async (req, res) => {
    try {
        const { hero_heading, hero_subtext, hero_image_url, hours, hours_note, banner_visible, banner_text } = req.body;
        const updates = { tenant_id: req.tenant.id };

        if (hero_heading !== undefined) updates.hero_heading = hero_heading;
        if (hero_subtext !== undefined) updates.hero_subtext = hero_subtext;
        if (hero_image_url !== undefined) updates.hero_image_url = hero_image_url;
        if (hours !== undefined) updates.hours = hours;
        if (hours_note !== undefined) updates.hours_note = hours_note;
        if (banner_visible !== undefined) updates.banner_visible = banner_visible;
        if (banner_text !== undefined) updates.banner_text = banner_text;

        const { error } = await supabase.from("site_settings").upsert(updates, {
            onConflict: "tenant_id"
        });
        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Dedicated Hero Customizer Data Bridge 
router.get("/api/settings/hero", async (req, res) => {
    try {
        const { data, error } = await supabase.from("site_settings")
            .select("hero_heading, hero_subtext, hero_image_url")
            .eq("tenant_id", req.tenant.id)
            .maybeSingle();

        if (error) return res.status(500).json({ error: error.message });

        res.json({
            title: data?.hero_heading || "",
            description: data?.hero_subtext || "",
            imageUrl: data?.hero_image_url || ""
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.put("/api/settings/footer", adminAuth, async (req, res) => {
    try {
        const { bio, email, phone, address } = req.body;

        const { data, error } = await supabase
            .from("tenant_settings")
            .upsert({
                tenant_id: String(req.tenant.id),
                footer_bio: bio,
                footer_email: email,
                footer_phone: phone,
                footer_address: address
            }, {
                onConflict: "tenant_id"
            });

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.get("/api/settings/footer", async (req, res) => {
    try {
        if (!req.tenant || !req.tenant.id) {
            return res.status(400).json({ error: "Tenant context structural validation missing." });
        }

        // 🌟 FIXED: String-casts the UUID lookup parameter to clear Postgres text crashes
        const { data, error } = await supabase
            .from("tenant_settings")
            .select("footer_bio, footer_email, footer_phone, footer_address")
            .eq("tenant_id", String(req.tenant.id))
            .maybeSingle(); // 🌟 FIXED: Safe single parser prevents crash loops on initial loads

        if (error) return res.status(500).json({ error: error.message });
        return res.json(data || {});
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 2. TENANT BUSINESS PROFILE ENDPOINTS
// ==========================================

// GET current profile settings
router.get("/api/settings/profile", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("tenants")
            .select("phone, business_hours")
            .eq("id", req.tenant.id)
            .maybeSingle();
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// PUT updated profile configurations
router.put("/api/settings/profile", adminAuth, async (req, res) => {
    try {
        const { phone, hours } = req.body;

        const { data, error } = await supabase
            .from("tenants")
            .update({ phone, business_hours: hours })
            .eq("id", req.tenant.id);

        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 3. CALENDAR AVAILABILITY ENDPOINTS
// ==========================================

// GET Availability Configuration Matrix
router.get("/api/settings/availability", async (req, res) => {
    try {
        if (!req.tenant || !req.tenant.id) {
            return res.status(400).json({ error: "Tenant context could not be resolved." });
        }

        const { data, error } = await supabase
            .from("availability_rules")
            .select("*")
            .eq("tenant_id", req.tenant.id)
            .order("day_of_week");

        if (error) {
            console.error("❌ SUPABASE GET AVAILABILITY ERROR:", error.message);
            return res.status(500).json({ error: error.message });
        }

        const formattedData = (data || []).map(r => ({
            ...r,
            start_time: r.start_time ? r.start_time.substring(0, 5) : "09:00",
            end_time: r.end_time ? r.end_time.substring(0, 5) : "17:00"
        }));

        return res.json(formattedData);

    } catch (err) {
        console.error("❌ Critical exception inside GET availability runtime:", err);
        return res.status(500).json({ error: err.message });
    }
});

// POST/UPSERT Bulk Availability Customization Array
router.post("/api/settings/availability", adminAuth, async (req, res) => {
    try {
        const { rules } = req.body;
        if (!rules || !Array.isArray(rules)) {
            return res.status(400).json({ error: "Invalid rules payload configuration." });
        }

        const payload = rules.map(r => {
            const padTime = (t) => {
                if (!t) return "00:00:00";
                const parts = t.split(':');
                return parts.length === 2 ? `${t}:00` : t;
            };

            return {
                tenant_id: req.tenant.id,
                day_of_week: parseInt(r.day_of_week),
                start_time: padTime(r.start_time),
                end_time: padTime(r.end_time),
                is_active: !!r.is_active,
                break_start: r.break_start || null,
                break_end: r.break_end || null,
            };
        });

        const { error } = await supabase
            .from("availability_rules")
            .upsert(payload, { onConflict: "tenant_id,day_of_week" });

        if (error) {
            console.error("❌ SUPABASE POST AVAILABILITY ERROR:", error.message, error.details);
            return res.status(500).json({ error: error.message });
        }

        return res.json({ success: true });

    } catch (err) {
        console.error("❌ Critical exception inside POST availability runtime:", err);
        return res.status(500).json({ error: err.message });
    }
});

// GET: Fetch existing integrations securely for dashboard views (Cleaned test setup)
router.get("/api/settings/integrations", adminAuth, async (req, res) => {
    try {
        if (!req.tenant || !req.tenant.id) {
            return res.status(400).json({ error: "Tenant context missing." });
        }

        const { data, error } = await supabase
            .from("tenant_settings")
            .select("stripe_publishable_key, stripe_secret_key, stripe_webhook_secret, resend_api_key")
            .eq("tenant_id", String(req.tenant.id))
            .maybeSingle();

        if (error) return res.status(500).json({ error: error.message });
        return res.json({
            stripe_publishable_key: data?.stripe_publishable_key || null,
            stripe_secret_key: data?.stripe_secret_key ? '••••••••' : null,
            stripe_webhook_secret: data?.stripe_webhook_secret ? '••••••••' : null,
            resend_api_key: data?.resend_api_key ? '••••••••' : null,
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 2. PUT: Update integrations records securely 
router.put("/api/settings/integrations", adminAuth, async (req, res) => {
    try {
        const { stripe_pub, stripe_sec, stripe_wh, resend_key } = req.body;

        const { data, error } = await supabase
            .from("tenant_settings")
            .upsert({
                tenant_id: String(req.tenant.id),
                stripe_publishable_key: stripe_pub,
                stripe_secret_key: stripe_sec,
                stripe_webhook_secret: stripe_wh,
                resend_api_key: resend_key
            }, {
                onConflict: "tenant_id"
            });

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;