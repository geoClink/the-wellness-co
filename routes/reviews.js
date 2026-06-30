const express = require("express");
const router = express.Router();
const supabase = require("../lib/supabase");
const { adminAuth } = require("../middleware/auth");

// 1. Public Fetch (stories.html)
router.get("/api/reviews", async (req, res) => {
    const { data, error } = await supabase.from("reviews")
        .select("*")
        .eq("tenant_id", req.tenant.id)
        .eq("approved", true)
        .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

// 2. Public Submission Form
router.post("/api/reviews", async (req, res) => {
    const { name, rating, body } = req.body;
    if (!name || !rating || !body) return res.status(400).json({ error: "Name, rating, and message are required." });
    const { error } = await supabase.from("reviews")
        .insert([{ tenant_id: req.tenant.id, name, rating: parseInt(rating), body, approved: false }]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// 3. Admin Panel Fetch (admin.html)
router.get("/api/admin/reviews", adminAuth, async (req, res) => {
    const { data, error } = await supabase.from("reviews")
        .select("*")
        .eq("tenant_id", req.tenant.id)
        .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

// 4. Admin Direct Create
router.post("/api/admin/reviews", adminAuth, async (req, res) => {
    const { name, rating, body } = req.body;
    if (!name || !rating || !body) return res.status(400).json({ error: "Name, rating, and body are required." });
    const { error } = await supabase.from("reviews")
        .insert([{ tenant_id: req.tenant.id, name, rating: parseInt(rating), body, approved: true }]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// 5. Admin Approve
router.patch("/api/reviews/:id/approve", adminAuth, async (req, res) => {
    const { error } = await supabase.from("reviews")
        .update({ approved: true })
        .eq("id", req.params.id)
        .eq("tenant_id", req.tenant.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// 6. Admin Delete
router.delete("/api/reviews/:id", adminAuth, async (req, res) => {
    try {
        const { error } = await supabase.from("reviews")
        .delete()
        .eq("id", req.params.id)
        .eq("tenant_id", req.tenant.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
    } catch (err) {
        console.error("Admin delete review failed.", err);
        return res.status(500).json({ error: err.message });
    }

});

// 🌟 7. Admin Toggle Feature Flag
router.patch("/api/reviews/:id/feature", adminAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // Step A: Turn off the featured status on ALL other reviews for this business
        await supabase.from("reviews")
            .update({ is_featured: false })
            .eq("tenant_id", req.tenant.id);

        // Step B: Set this specific review as the singular featured one
        const { data, error } = await supabase.from("reviews")
            .update({ is_featured: true })
            .eq("id", id)
            .eq("tenant_id", req.tenant.id)
            .select();

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 🌟 8. Public Fetch Single Featured Review (Used by index.html)
router.get("/api/reviews/featured", async (req, res) => {
    try {
        const { data, error } = await supabase.from("reviews")
            .select("*")
            .eq("tenant_id", req.tenant.id)
            .eq("is_featured", true)
            .maybeSingle();

        if (error) return res.status(500).json({ error: error.message });
        return res.json(data || {});
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;