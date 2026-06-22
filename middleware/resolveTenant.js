const supabase = require("../lib/supabase");

const tenantCache = new Map();

async function resolveTenant(req, res, next) {
    const hostname = req.hostname;

    const slug = process.env.TENANT_SLUG
        || (hostname === "localhost" || hostname === "127.0.0.1"
            ? "the-wellness-co"
            : hostname.split(".")[0]);
    if (tenantCache.has(slug)) {
        req.tenant = tenantCache.get(slug);
        return next();
    }


    const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("id, name, vertical, slug, owner_email, address, contact_email")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();

    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    tenantCache.set(slug, tenant);
    req.tenant = tenant;
    next();
}

module.exports = resolveTenant;


