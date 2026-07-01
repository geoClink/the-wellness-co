-- Add cancel_token to appointments
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS cancel_token uuid DEFAULT gen_random_uuid();

-- Add slug to services
ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS slug text;

-- Add is_featured to reviews
ALTER TABLE public.reviews
    ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- Per-tenant integration keys and footer content
CREATE TABLE IF NOT EXISTS public.tenant_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    stripe_publishable_key text,
    stripe_secret_key text,
    stripe_webhook_secret text,
    resend_api_key text,
    footer_bio text,
    footer_email text,
    footer_phone text,
    footer_address text,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT tenant_settings_tenant_id_unique UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant_id ON public.tenant_settings (tenant_id);

-- Admin-configurable availability schedule (one row per day per tenant)
CREATE TABLE IF NOT EXISTS public.availability_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time time NOT NULL DEFAULT '09:00:00',
    end_time time NOT NULL DEFAULT '17:00:00',
    is_active boolean NOT NULL DEFAULT true,
    break_start time,
    break_end time,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT availability_rules_tenant_day_unique UNIQUE (tenant_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_availability_rules_tenant_id ON public.availability_rules (tenant_id);

-- Dates the admin has blocked off (no bookings allowed)
CREATE TABLE IF NOT EXISTS public.blocked_dates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    date date NOT NULL,
    reason text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blocked_dates_tenant_id ON public.blocked_dates (tenant_id);
CREATE INDEX IF NOT EXISTS idx_blocked_dates_date ON public.blocked_dates (date);
