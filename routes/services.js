const express = require("express");
const router = express.Router();
const supabase = require("../lib/supabase");
const { adminAuth } = require("../middleware/auth");


router.get("/api/services", async (req, res) => {
    const { data, error } = await supabase.from("services")
        .select("*")
        .eq("tenant_id", req.tenant.id)
        .order("sort_order");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post("/api/services", adminAuth, async (req, res) => {
    const { name, duration_minutes, price, description, img, active } = req.body;
    if (!name || !price) return res.status(400).json({ error: "Name and price are required." });
    const { error } = await supabase.from("services")
        .insert([{ tenant_id: req.tenant.id, name, duration_minutes, price, description, img, active: active ?? true }]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.patch("/api/services/:id", adminAuth, async (req, res) => {
    const { name, duration_minutes, price, description, img,
        active } = req.body;
    const { error } = await supabase.from("services")
        .update({
            name, duration_minutes, price, description,
            img, active
        })
        .eq("id", req.params.id)
        .eq("tenant_id", req.tenant.id);
    if (error) return res.status(500).json({
        error: error.message
    });
    res.json({ success: true });
});

module.exports = router;