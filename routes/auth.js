const express = require("express");
const router = express.Router();
const supabase = require("../lib/supabase");

router.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: "Invalid email or password." });
    res.json({ token: data.session.access_token });
});

module.exports = router;