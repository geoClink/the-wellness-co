const express = require("express");
const router = require("express").Router();
const supabase = require("../lib/supabase");
const { adminAuth } = require("../middleware/auth");

router.get("/api/blocked-dates", adminAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("blocked_dates")
            .select("*")
            .eq("tenant_id", req.tenant.id)
            .order("date")

        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.post("/api/blocked-dates", adminAuth, async (req, res) => {
    try {
        const {
            date, reason
        } = req.body;

        const { error } = await supabase
            .from("blocked_dates")
            .insert({ tenant_id: req.tenant.id, date, reason });

        if (error) {
            console.error(" SUPASEBASE BLOCKED DATE INSERT FAILED:", error.message, error.details);
            return res.status(500).json({ error: error.message });
        }

        return res.json({ success: true });

    } catch (err) {
        console.error("Blocked date entry failed.", err);
        return res.status(500).json({ error: err.message});
    }
});

router.delete("/api/blocked-dates/:id", adminAuth, async (req, res) => {
    try {
        const { error } = await supabase.from("blocked_dates")
    .delete()
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenant.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json ({ success: true });
    } catch (err) {
        console.error("Blocked date deletion failed.", err);
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;