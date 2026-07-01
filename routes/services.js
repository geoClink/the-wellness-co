const express = require("express");
const router = express.Router();
const supabase = require("../lib/supabase");
const { adminAuth } = require("../middleware/auth");

// 1. Fetch Active Catalog Menu Options
router.get("/api/services", async (req, res) => {
    const { data, error } = await supabase.from("services")
        .select("*")
        .eq("tenant_id", req.tenant.id)
        .order("name");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

// 2. Commit New Treatment Asset Profile
// 2. Commit New Treatment Asset Profile
router.post("/api/services/admin", adminAuth, async (req, res) => {
    const { title, description, price } = req.body;
    const serviceName = title || req.body.name;

    if (!serviceName || !price) {
        return res.status(400).json({ error: "Service title and price are required." });
    }

    // 🌟 THE CONSTRAINT FIX: Convert name string into a clean URL-friendly slug
    const serviceSlug = serviceName
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')     // Strip out unusual characters
        .replace(/[\s_-]+/g, '-')     // Swap all spaces and underscores to singular hyphens
        .replace(/^-+|-+$/g, '');     // Clean up loose edges

    const { data, error } = await supabase
        .from("services")
        .insert([{
            tenant_id: req.tenant.id,
            name: serviceName,
            slug: serviceSlug,        // 🎯 Passes the required not-null slug column check!
            description: description || "",
            price: parseFloat(price),
            duration_minutes: 60,
            active: true
        }])
        .select()
        .single();

    if (error) {
        console.error("❌ Supabase Insertion Error:", error);
        return res.status(500).json({ error: error.message });
    }

    res.status(201).json(data);
});

// 3. Delete Active Service Profiles
router.delete("/api/services/admin/:id", adminAuth, async (req, res) => {
    const { error } = await supabase
        .from("services")
        .delete()
        .eq("id", req.params.id)
        .eq("tenant_id", req.tenant.id);

    if (error) {
        console.error("❌ Supabase Deletion Error:", error);
        return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
});

router.patch("/api/services/admin/:id", adminAuth, async (req, res) => {
    try {
        const { name, description, price } = req.body;
        const { error } = await supabase
            .from("services")
            .update({ name, description, price })
            .eq("id", req.params.id)
            .eq("tenant_id", req.tenant.id);

        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;