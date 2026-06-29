const { createClient } = require("@supabase/supabase-js");

// Temporary Debug Logs
console.log("--- SUPABASE CONNECTION DEBUG ---");
console.log("TARGET URL:", process.env.SUPABASE_URL);
console.log("USING KEY (Length):", process.env.SUPABASE_ANON_KEY ? process.env.SUPABASE_ANON_KEY.length : "0 (MISSING)");
console.log("---------------------------------");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

module.exports = supabase;