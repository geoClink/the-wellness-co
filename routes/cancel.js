const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

router.get('/api/cancel', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ error: 'Missing token.' });

        const { data: appt, error } = await supabase
            .from('appointments')
            .select('id, guest_name, date, time, status, payment_intent_id, tenant_id')
            .eq('cancel_token', token)
            .single();

        if (error || !appt) return res.status(404).json({ error: 'Appointment not found.' });
        if (appt.status === 'cancelled') return res.status(400).json({ error: 'This appointment is already cancelled.' });

        const apptTime = new Date(`${appt.date} ${appt.time}`);
        const hoursUntil = (apptTime - Date.now()) / (1000 * 60 * 60);

        let refundType;
        if (hoursUntil > 48) refundType = 'full';
        else if (hoursUntil > 0) refundType = 'half';
        else refundType = 'none';

        res.json({
            guest_name: appt.guest_name,
            date: appt.date,
            time: appt.time,
            hoursUntil: Math.round(hoursUntil),
            refundType
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.post('/api/cancel', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: 'Missing token.' });

        const { data: appt, error } = await supabase
            .from('appointments')
            .select('id, date, time, status, payment_intent_id, tenant_id')
            .eq('cancel_token', token)
            .single();

        if (error || !appt) return res.status(404).json({ error: 'Appointment not found.' });
        if (appt.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled.' });

        const hoursUntil = (new Date(`${appt.date} ${appt.time}`) - Date.now()) / (1000 * 60 * 60);

        const { data: settings } = await supabase
            .from('site_settings')
            .select('stripe_secret_key')
            .eq('tenant_id', appt.tenant_id)
            .single();

        if (appt.payment_intent_id && settings?.stripe_secret_key) {
            const stripe = require('stripe')(settings.stripe_secret_key);
            const intent = await stripe.paymentIntents.retrieve(appt.payment_intent_id);
            const refundAmount = hoursUntil > 48 ? intent.amount : Math.round(intent.amount / 2);

            if (hoursUntil > 0) {
                await stripe.refunds.create({
                    payment_intent: appt.payment_intent_id,
                    amount: refundAmount
                });
            }
        }

        await supabase
            .from('appointments')
            .update({ status: 'cancelled' })
            .eq('id', appt.id);

        const refundType = hoursUntil > 48 ? 'full' : hoursUntil > 0 ? 'half' : 'none';
        res.json({ success: true, refundType });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
module.exports = router;