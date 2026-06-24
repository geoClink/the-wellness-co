const supabase = require("../lib/supabase");

const tenantCache = new Map();

async function resolveTenant(req, res, next) {
    const hostname = req.hostname;

    const slug = process.env.TENANT_SLUG
        || (hostname === "localhost" || hostname === "127.0.0.1"
            ? "the-wellness-co"
            : hostname.split(".")[0]);
    if (tenantCache.has(slug)) {
        const cached = tenantCache.get(slug);
        if (Date.now() - cached._cachedAt < 5 * 60 * 1000) {
            req.tenant = cached;
            return next();
        }
        tenantCache.delete(slug);
    }


    const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("id, name, vertical, slug, owner_email, address, contact_email")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();

    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    tenantCache.set(slug, { ...tenant, _cachedAt: Date.now() });
    req.tenant = tenant;
    next();
}

module.exports = resolveTenant;


