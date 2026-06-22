const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail(to, subject, html) {
    try {
        await resend.emails.send({
            from: "onboarding@resend.dev",
            to,
            subject,
            html
        });
        console.log("Email sent:", subject);
    } catch (err) {
        console.error("Resend error:", err.message);
    }
}

function emailTemplate(title, bodyHtml, tenant = {}) {
    const bizName = tenant.name || "The Wellness Co.";
    const bizAddress = tenant.address || "123 Sugar Lane, Anytown, MI";
    const bizEmail = tenant.contact_email || "info@wellnessco.com";
    return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <div style="background:#1a1a1a;padding:24px 32px;text-align:center;">
    <p style="margin:0;font-size:22px;color:#D4a853;font-family:Georgia,serif;letter-spacing:1px;">&#127807; ${bizName}</p>
  </div>
  <div style="padding:32px;">
    <h2 style="margin:0 0 20px;color:#1a1a1a;font-family:Georgia,serif;font-size:22px;">${title}</h2>
    ${bodyHtml}
  </div>
  <div style="background:#f9f9f9;padding:20px 32px;text-align:center;border-top:1px solid #eee;">
    <p style="margin:0;font-size:13px;color:#999;">${bizName} &middot; ${bizAddress}</p>
    <p style="margin:4px 0 0;font-size:13px;"><a href="mailto:${bizEmail}" style="color:#D4a853;text-decoration:none;">${bizEmail}</a></p>
  </div>
</div>
</body></html>`;
}

module.exports = { sendEmail, emailTemplate };