const express = require("express");
const router = express.Router();

const supabase = require("../lib/supabase");
const { adminAuth } = require("../middleware/auth");

router.get("/api/reviews", async (req, res) => {
    const { data, error } = await supabase.from("reviews")
        .select("*")
        .eq("tenant_id", req.tenant.id)
        .eq("approved", true)
        .order("created_at", { ascending: false });
    if (error) return res.status(500).json({
        error: error.message
    });
    res.json(data);
});

router.post("/api/reviews", async (req, res) => {
    const { name, rating, body } = req.body;
    if (!name || !rating || !body) return res.status(400).json({
        error: "Name, rating, and message are required."
    });
    const { error } = await supabase.from("reviews")
        .insert([{
            tenant_id: req.tenant.id, name, rating, body,
            approved: false
        }]);
    if (error) return res.status(500).json({
        error: error.message
    });
    res.json({ success: true });
});

router.get("/api/admin/reviews", adminAuth, async (req, res) => {
    const { data, error } = await supabase.from("reviews")
        .select("*")
        .eq("tenant_id", req.tenant.id)
        .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post("/api/admin/reviews", adminAuth, async (req, res) => {
    const { name, rating, body } = req.body;
    if (!name || !rating || !body) return res.status(400).json({ error: "Name, rating, and body are required." });
    const { error } = await supabase.from("reviews")
        .insert([{ tenant_id: req.tenant.id, name, rating: parseInt(rating), body, approved: true }]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.patch("/api/reviews/:id/approve", adminAuth, async (req, res) => {
    const { error } = await supabase.from("reviews")
        .update({ approved: true })
        .eq("id", req.params.id)
        .eq("tenant_id", req.tenant.id);
    if (error) return res.status(500).json({
        error: error.message
    });
    res.json({ success: true });
});

router.delete("/api/reviews/:id", adminAuth, async (req, res) => {
    const { error } = await supabase.from("reviews")
        .delete()
        .eq("id", req.params.id)
        .eq("tenant_id", req.tenant.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// Inside routes/reviews.js
router.get("/api/admin/reviews", adminAuth, async (req, res) => {
    const { data, error } = await supabase.from("reviews")
        .select("*")
        .eq("tenant_id", req.tenant.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

module.exports = router;