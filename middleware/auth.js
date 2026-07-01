const supabase = require("../lib/supabase");

const adminAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace("Bearer ", "");
        if (!token) return res.status(401).json({ error: "Unauthorized" });

        if (process.env.DEMO_TOKEN && token === process.env.DEMO_TOKEN) {
            if (req.method !== "GET") {
                return res.status(403).json({ error: "Read-only demo — this action is disabled." });
            }
            req.isDemo = true;
            return next();
        }

        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return res.status(401).json({ error: "Unauthorized" });

        const ownerEmail = req.tenant?.owner_email || process.env.OWNER_EMAIL;
        if (user.email !== ownerEmail) return res.status(403).json({ error: "Forbidden" });

        req.user = user;
        next();
    } catch (err) {
        console.error("🔒 Auth Middleware Exception:", err);
        return res.status(500).json({ error: "Internal Authentication Error" });
    }
};

const userAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace("Bearer ", "");
        if (!token) return res.status(401).json({ error: "Unauthorized" });

        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return res.status(401).json({ error: "Unauthorized" });

        req.user = user;
        next();
    } catch (err) {
        console.error("🔒 User Auth Middleware Exception:", err);
        return res.status(500).json({ error: "Internal Authentication Error" });
    }
};

// 🎯 WATERTIHGT EXPORT LAYOUT
// This guarantees that no matter how Node reads the file, the keys resolve to actual functions.
module.exports = {
    adminAuth: adminAuth,
    userAuth: userAuth
};