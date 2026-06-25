require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const reviews = [
    { name: "Hanna R.", rating: 5, body: "After one QHHT session I finally understood a fear I'd carried my whole life. I left lighter than I have in years." },
    { name: "Marcus T.", rating: 5, body: "The biofield tuning was unlike anything I've experienced. I could actually feel the static leave my body." },
    { name: "Priya N.", rating: 5, body: "I come for Reiki monthly now. It's become my reset button — my whole week softens after." },
    { name: "Devon L.", rating: 5, body: "Cognomovement helped me move past a creative block I'd been stuck in for months. Gentle and oddly powerful." },
    { name: "Sarah K.", rating: 5, body: "Calm, intuitive, and deeply skilled. I always feel safe and genuinely heard here." },
    { name: "Tom B.", rating: 5, body: "The acupuncture sessions resolved migraines I'd had for nearly a decade. I'm so grateful." },
];

async function seed() {
    const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("id")
        .eq("slug", process.env.TENANT_SLUG)
        .single();

    if (tenantError || !tenant) {
        console.error("Could not find tenant:", tenantError?.message);
        process.exit(1);
    }

    const rows = reviews.map(r => ({ ...r, tenant_id: tenant.id, approved: true }));

    const { error } = await supabase.from("reviews").insert(rows);

    if (error) {
        console.error("Insert failed:", error.message);
        process.exit(1);
    }

    console.log(`Inserted ${rows.length} reviews successfully.`);
}

seed();
