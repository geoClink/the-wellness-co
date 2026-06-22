-- Seed the wellness tenant
INSERT INTO public.tenants (name, slug, vertical, owner_email, contact_email)
VALUES ('The Wellness Co.', 'the-wellness-co', 'wellness', 'owner@thewellnessco.com', 'info@thewellnessco.com')
ON CONFLICT (slug) DO NOTHING;

-- Services offered by the practitioner
CREATE TABLE IF NOT EXISTS public.services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    name text NOT NULL,
    duration_minutes integer NOT NULL DEFAULT 60,
    price numeric(10, 2) NOT NULL,
    description text,
    img text,
    active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_tenant_id ON public.services (tenant_id);

-- Appointments booked by clients
CREATE TABLE IF NOT EXISTS public.appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    service_id uuid REFERENCES public.services(id),
    guest_name text NOT NULL,
    email text NOT NULL,
    phone text,
    date date NOT NULL,
    time text NOT NULL,
    status text NOT NULL DEFAULT 'confirmed',
    notes text,
    payment_intent_id text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_id ON public.appointments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments (date);

-- Client reviews (require admin approval before showing)
CREATE TABLE IF NOT EXISTS public.reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    name text NOT NULL,
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    body text NOT NULL,
    approved boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_tenant_id ON public.reviews (tenant_id);

-- Contact form submissions
CREATE TABLE IF NOT EXISTS public.contact_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    name text NOT NULL,
    email text NOT NULL,
    subject text NOT NULL DEFAULT 'General',
    message text NOT NULL,
    read boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_tenant_id ON public.contact_submissions (tenant_id);

-- Site settings (one row per tenant)
CREATE TABLE IF NOT EXISTS public.site_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    hero_heading text,
    hero_subtext text,
    hero_image_url text,
    hours jsonb,
    hours_note text,
    banner_visible boolean NOT NULL DEFAULT false,
    banner_text text,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT site_settings_tenant_id_unique UNIQUE (tenant_id)
);
