const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

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

module.exports = router;