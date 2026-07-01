-- ============================================================
-- DEMO SEED DATA — Run once in Supabase SQL Editor
-- Targets tenant slug: the-wellness-co
-- Safe to re-run: checks for existing demo records first
-- ============================================================

DO $$
DECLARE
    v_tenant_uuid uuid;   -- for tables where tenant_id is uuid
    v_tenant_text text;   -- for tables where tenant_id is text
    v_service_id  uuid;
BEGIN

    -- 1. Get the tenant
    SELECT id INTO v_tenant_uuid
    FROM tenants
    WHERE slug = 'the-wellness-co'
    LIMIT 1;

    IF v_tenant_uuid IS NULL THEN
        RAISE EXCEPTION 'Tenant not found. Check your slug.';
    END IF;

    v_tenant_text := v_tenant_uuid::text;

    -- 2. Get a service to attach appointments to
    SELECT id INTO v_service_id
    FROM services
    WHERE tenant_id::uuid = v_tenant_uuid
    LIMIT 1;

    -- 3. Seed appointments (tenant_id is uuid)
    IF NOT EXISTS (
        SELECT 1 FROM appointments
        WHERE tenant_id = v_tenant_uuid
        AND guest_name = 'Sarah Mitchell'
    ) THEN
        INSERT INTO appointments (tenant_id, service_id, guest_name, email, phone, date, time, notes, status, payment_intent_id)
        VALUES
            (v_tenant_uuid, v_service_id, 'Sarah Mitchell',  'sarah.mitchell@email.com',  '(312) 555-0182', CURRENT_DATE + 2,  '10:00 AM', 'First time client, lower back tension.', 'confirmed',  'pi_demo_001'),
            (v_tenant_uuid, v_service_id, 'James Okafor',    'james.okafor@email.com',    '(773) 555-0394', CURRENT_DATE + 3,  '02:00 PM', 'Returning client. Shoulder and neck.',    'confirmed',  'pi_demo_002'),
            (v_tenant_uuid, v_service_id, 'Priya Nair',      'priya.nair@email.com',      '(847) 555-0671', CURRENT_DATE + 5,  '11:00 AM', 'Interested in stress relief protocol.',   'confirmed',  'pi_demo_003'),
            (v_tenant_uuid, v_service_id, 'Tom Larsen',      'tom.larsen@email.com',      '(630) 555-0258', CURRENT_DATE + 7,  '03:00 PM', '',                                        'confirmed',  'pi_demo_004'),
            (v_tenant_uuid, v_service_id, 'Maya Chen',       'maya.chen@email.com',       '(312) 555-0817', CURRENT_DATE - 3,  '09:00 AM', 'Migraine follow-up.',                     'completed',  'pi_demo_005'),
            (v_tenant_uuid, v_service_id, 'David Reyes',     'david.reyes@email.com',     '(708) 555-0543', CURRENT_DATE - 7,  '01:00 PM', 'Sciatica treatment.',                     'completed',  'pi_demo_006'),
            (v_tenant_uuid, v_service_id, 'Lindsey Park',    'lindsey.park@email.com',    '(773) 555-0129', CURRENT_DATE - 10, '11:00 AM', 'Changed plans.',                          'cancelled',  'pi_demo_007');
    END IF;

    -- 4. Seed reviews (tenant_id is uuid)
    IF NOT EXISTS (
        SELECT 1 FROM reviews
        WHERE tenant_id = v_tenant_uuid
        AND name = 'Sarah M.'
    ) THEN
        INSERT INTO reviews (tenant_id, name, rating, body, approved, is_featured)
        VALUES
            (v_tenant_uuid, 'Sarah M.',   5, 'Absolutely incredible experience. I came in with chronic lower back pain and left feeling like a new person. Will definitely be back.',                    true,  true),
            (v_tenant_uuid, 'James O.',   5, 'Professional, calming, and genuinely effective. My shoulder tension from years of desk work has noticeably improved after just two sessions.',           true,  true),
            (v_tenant_uuid, 'Priya N.',   5, 'I was skeptical about acupuncture but this completely changed my mind. The space is beautiful and the treatment was exactly what I needed.',             true,  false),
            (v_tenant_uuid, 'Maya C.',    4, 'Great experience overall. My migraines have been less frequent since starting treatment. Highly recommend for anyone dealing with stress or headaches.',  true,  false),
            (v_tenant_uuid, 'Tom L.',     5, 'World-class service. Booked online in under a minute and the whole appointment was seamless. The results speak for themselves.',                         true,  false),
            (v_tenant_uuid, 'Hannah R.',  4, 'Very relaxing environment and knowledgeable practitioner. I appreciated how thorough the intake process was. Will return for sure.',                    false, false);
    END IF;

    -- 5. Seed contact messages (tenant_id is uuid)
    IF NOT EXISTS (
        SELECT 1 FROM contact_submissions
        WHERE tenant_id = v_tenant_uuid
        AND email = 'bakery.owner@example.com'
    ) THEN
        INSERT INTO contact_submissions (tenant_id, name, email, subject, message, read)
        VALUES
            (v_tenant_uuid, 'Rachel Kim',    'rachel.kim@gmail.com',        'Question about packages',   'Hi! Do you offer any monthly packages or memberships? I''d love to come in regularly.',                                    false),
            (v_tenant_uuid, 'Carlos Vega',   'carlos.vega@outlook.com',     'Gift card inquiry',         'Do you sell gift cards? Looking to get one for my wife''s birthday next week.',                                           false),
            (v_tenant_uuid, 'Nina Patel',    'nina.patel@email.com',        'First appointment nerves',  'This would be my first time trying acupuncture. Is there anything I should do to prepare beforehand?',                    true),
            (v_tenant_uuid, 'Mark Donovan',  'bakery.owner@example.com',    'Booking system question',   'I run a small bakery and I''m looking for a booking system like this for my business. Who built this for you?',           false);
    END IF;

    RAISE NOTICE 'Demo seed complete for tenant: %', v_tenant_uuid;

END $$;
