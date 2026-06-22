const supabase = require ("../lib/supabase");

const adminAuth = async (req, res, next) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: "Unauthorized" });
    const ownerEmail = req.tenant?.owner_email || process.env.OWNER_EMAIL;
    if (user.email !== ownerEmail) return res.status(403).json({ error: "Forbidden" });
    next();
};

const userAuth = async (req, res, next) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if(error || !user) return res.status(401).json({ error: "Unauthorized" });
    req.user = user;
    next();
};

module.exports = { adminAuth, userAuth };