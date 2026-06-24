const express = require("express");
const router = express.Router();
const supabase = require("../lib/supabase");
const { adminAuth } = require("../middleware/auth");
const { sendEmail, emailTemplate } = require("../lib/email");

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

router.post("/api/contact", async (req, res) => {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ error: "Name, email, and message are required." });
    }

    const { error } = await supabase.from("contact_submissions")
        .insert([{ tenant_id: req.tenant.id, name, email, subject: subject || "General", message }]);
    if (error) return res.status(500).json({ error: error.message });

    await sendEmail(process.env.OWNER_EMAIL, `New Contact Message from ${name}`,
        emailTemplate("New Contact Message", `
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <p><strong>Subject:</strong> ${subject || "General"}</p>
            <p><strong>Message:</strong></p>
            <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
        `, req.tenant)
    );

    res.json({ success: true });
});

router.get("/api/contact", adminAuth, async (req, res) => {
    const { data, error } = await supabase.from("contact_submissions").select("*")
        .eq("tenant_id", req.tenant.id).order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.patch("/api/contact/:id/read", adminAuth, async (req, res) => {
    const { error } = await supabase.from("contact_submissions").update({ read: true })
        .eq("id", req.params.id).eq("tenant_id", req.tenant.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

module.exports = router;