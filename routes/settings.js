const express = require("express");
const router = express.Router();
const supabase = require("../lib/supabase");
const { adminAuth } = require("../middleware/auth");

router.get("/api/site-settings", async (req, res) => {
    const { data, error } = await supabase.from("site_settings").select("*")
        .eq("tenant_id", req.tenant.id).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data ?? {});
});

router.patch("/api/site-settings", adminAuth, async (req, res) => {
    const { hero_heading, hero_subtext, hero_image_url, hours, hours_note, banner_visible, banner_text } = req.body
    const updates = { tenant_id: req.tenant.id };
    if (hero_heading !== undefined) updates.hero_heading = hero_heading;
    if (hero_subtext !== undefined) updates.hero_subtext = hero_subtext;
    if (hero_image_url !== undefined) updates.hero_image_url = hero_image_url;
    if (hours !== undefined) updates.hours = hours;
    if (hours_note !== undefined) updates.hours_note = hours_note;
    if (banner_visible !== undefined) updates.banner_visible = banner_visible;
    if (banner_text !== undefined) updates.banner_text = banner_text;
    const { error } = await supabase.from("site_settings").upsert(updates, {
        onConflict: "tenant_id"
    });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.get("/api/settings/hero", async (req, res) => {
    const { data, error } = await supabase.from("site_settings")
        .select("hero_heading, hero_image_url")
        .eq("tenant_id", req.tenant.id)
        .maybeSingle();
        
    if (error) return res.status(500).json({ error: error.message });
    
    res.json({
        title: data?.hero_heading || "",
        imageUrl: data?.hero_image_url || ""
    });
});

module.exports = router;