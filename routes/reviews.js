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


module.exports = router;