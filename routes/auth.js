const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");

router.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            process.env.DEMO_EMAIL && process.env.DEMO_PASSWORD && process.env.DEMO_TOKEN &&
            email === process.env.DEMO_EMAIL && password === process.env.DEMO_PASSWORD
        ) {
            return res.json({ token: process.env.DEMO_TOKEN, isDemo: true });
        }

        // Isolate client creation directly to the route execution stack
        // to prevent global thread pooling/tenant resolution bugs on serverless runtimes.
        const authClient = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY,
            { auth: { persistSession: false } } // Disables cookie storage memory locks
        );

        const { data, error } = await authClient.auth.signInWithPassword({ email, password });
        
        if (error) {
            console.log("❌ SUPABASE AUTH REJECTION REASON:", error.status, error.message);
            return res.status(401).json({ error: "Invalid email or password." });
        }
        
        res.json({ token: data.session.access_token });
    } catch (err) {
        console.error("Login Exception caught:", err.message);
        res.status(500).json({ error: "Internal service routing failure." });
    }
});

router.get("/api/demo-login", async (req, res) => {
    if (!process.env.DEMO_TOKEN) {
        return res.status(404).json({ error: "Demo not configured." });
    }
    return res.json({ token: process.env.DEMO_TOKEN, isDemo: true });
});

router.post("/api/reset-password", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required." });

        const authClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { error } = await authClient.auth.resetPasswordForEmail(email, {
            redirectTo: `${req.protocol}://${req.get('host')}/admin.html`
        });

        if (error) return res.status(400).json({ error: error.message });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to send reset email." });
    }
});

router.post("/api/update-password", async (req, res) => {
    try {
        const { password, accessToken, refreshToken } = req.body;
        if (!password || !accessToken) return res.status(400).json({ error: "Missing required fields." });

        const authClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        await authClient.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        const { error } = await authClient.auth.updateUser({ password });

        if (error) return res.status(400).json({ error: error.message });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to update password." });
    }
});

module.exports = router;