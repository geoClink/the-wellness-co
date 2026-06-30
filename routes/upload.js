const express = require("express");
const router = express.Router();
const supabase = require("../lib/supabase");
const { adminAuth } = require("../middleware/auth");

const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

router.post("/api/upload/site-image", adminAuth, upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file provided." });

        const ext = req.file.mimetype.split("/")[1];
        const fileName = `${req.tenant.id}/${Date.now()}.${ext}`;

        const { error } = await supabase.storage
            .from("wellness-co-images")
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: true
            });

        if (error) return res.status(500).json({ error: error.message });

        const { data } = supabase.storage
            .from("wellness-co-images")
            .getPublicUrl(fileName);

        return res.json({ url: data.publicUrl });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;