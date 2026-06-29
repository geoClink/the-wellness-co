const { Resend } = require('resend');
const supabase = require('../lib/supabase');

/**
 * Dynamically switches email sending credentials based on the tenant's settings
 */
async function sendDynamicTenantEmail(tenantId, emailOptions) {
    try {
        // 1. Fetch this specific tenant's custom configurations row
        const { data: settings, error } = await supabase
            .from("tenant_settings")
            .select("resend_api_key")
            .eq("tenant_id", tenantId)
            .maybeSingle();

        // 2. Fall back cleanly if they haven't plugged their own key in yet
        const activeApiKey = (!error && settings && settings.resend_api_key) 
            ? settings.resend_api_key 
            : process.env.STRIPE_SECRET_KEY; // Fallback to process env master key if empty

        if (!activeApiKey) {
            throw new Error("No valid Resend API key resolved.");
        }

        const resend = new Resend(activeApiKey);

        // 3. Fire the email delivery
        const data = await resend.emails.send({
            from: emailOptions.from || 'The Wellness Co. <bookings@thewellnessco.com>',
            to: emailOptions.to,
            subject: emailOptions.subject,
            html: emailOptions.html
        });

        console.log(`✉️ Email successfully dispatched via dynamic scope for tenant: ${tenantId}`);
        return { success: true, data };

    } catch (err) {
        console.error("❌ sendDynamicTenantEmail crash event handler caught:", err);
        return { success: false, error: err.message };
    }
}

module.exports = { sendDynamicTenantEmail };