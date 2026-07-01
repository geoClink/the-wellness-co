# The Wellness Co.

A full-stack, multi-tenant booking platform for wellness and energy healing practices. Clients can browse services, book appointments, and pay securely through Stripe. Practitioners manage everything through a password-protected admin dashboard.

Built as a learning project while transitioning from Swift/SwiftUI to web development.

## Demo

https://github.com/user-attachments/assets/f558698f-1bda-43a5-9770-638f02d315e4

## Features

### Booking Flow
Clients select a service, pick a date from a live availability calendar, choose a time slot, and enter their details. Submitting the form creates a pending appointment and redirects to Stripe Checkout for payment. The appointment is only confirmed once the Stripe webhook fires — so no booking is saved to the database without a completed payment.

### No Double Bookings
Available time slots are calculated server-side on every request. Any slot that already has a confirmed or pending appointment on that date is excluded from the response. Clients only ever see genuinely open times.

### Cancellations
Every confirmation email includes a unique cancellation link tied to a secure token. Clients can cancel their own appointment without logging in or contacting the practitioner. Refunds are issued automatically through the Stripe API on a time-based policy: full refund if cancelled more than 48 hours before the appointment, half refund within 48 hours, no refund if the appointment time has passed.

### Rescheduling
Clients can reschedule directly from their confirmation email. The original appointment is cancelled and a full refund is issued via Stripe, then the client is sent through a new booking flow to select a different date and time. No manual intervention required.

### Admin Dashboard
Password-protected dashboard for the practitioner to manage the entire site:
- View bookings and cancel with automatic full Stripe refund
- Add, edit, and delete services
- Set weekly availability and block specific dates
- Approve client reviews and mark featured testimonials
- Edit homepage, about page, and footer content
- Connect Stripe and Resend accounts directly from the Settings tab — no code changes or redeployment needed

### Transactional Email
Booking confirmations, cancellation receipts, and reschedule links are sent automatically via Resend. Emails include appointment details, a calendar-friendly summary, and the self-serve cancellation link.

## Stack

**Frontend**
- HTML, CSS, JavaScript (vanilla)
- Mobile-first responsive design

**Backend**
- Node.js + Express
- Supabase (PostgreSQL) for the database
- Stripe for payment processing and refunds
- Resend for transactional email
- Helmet for security headers
- express-rate-limit for API protection

**Deployed on Render**

## Pages

| Page | Description |
|---|---|
| `index.html` | Home — hero, services grid, meet the practitioner, testimonials |
| `about.html` | Practitioner bio, training, certifications |
| `services.html` | Full service list with pricing and booking links |
| `appointments.html` | Booking flow — service, date, time, personal details |
| `confirmation.html` | Post-booking confirmation |
| `cancel.html` | Self-serve cancellation and reschedule flow |
| `contact.html` | Contact form |
| `faq.html` | FAQ accordion |
| `stories.html` | Client testimonials |
| `admin.html` | Password-protected admin dashboard |
| `privacy.html` | Privacy policy |
| `terms.html` | Terms of service |

## API Routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/services` | Fetch active services |
| GET | `/api/availability?date=YYYY-MM-DD` | Available time slots for a date |
| POST | `/api/appointments` | Initiate Stripe checkout |
| POST | `/stripe-webhook` | Stripe webhook — saves appointment and sends confirmation email |
| GET | `/api/cancel?token=` | Load appointment details for cancellation |
| POST | `/api/cancel` | Cancel appointment and issue refund |
| POST | `/api/reschedule` | Reschedule appointment and issue full refund |
| POST | `/api/admin/appointments/:id/cancel` | Admin cancel with automatic full Stripe refund |
| POST | `/api/contact` | Submit contact form |
| POST | `/api/login` | Admin login via Supabase Auth |
| POST | `/api/reset-password` | Send password reset email |
| POST | `/api/update-password` | Set new password via reset token |
| GET/PUT | `/api/settings/footer` | Footer content |
| GET/POST | `/api/settings/availability` | Weekly availability schedule |
| GET/PUT | `/api/settings/integrations` | Per-tenant Stripe and Resend keys |
| GET/POST/DELETE | `/api/blocked-dates` | Admin-blocked dates |
| GET/POST | `/api/reviews` | Client reviews with admin approval |

## Local Setup

```bash
# Install dependencies
npm install

# Create a .env file with the following:
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
TENANT_SLUG=the-wellness-co

# Start the server
node server.js
```

The server runs on `http://localhost:3000` by default.

## Environment Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `SUPABASE_ANON_KEY` | Supabase anon key (used for auth) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `TENANT_SLUG` | Slug identifying which tenant to load (e.g. `the-wellness-co`) |

## Database Setup

Run the migration files in order against your Supabase project:

```
migrations/001_create_tables.sql
migrations/002_add_missing_tables.sql
```

Then insert a tenant row:

```sql
INSERT INTO public.tenants (name, slug, vertical, owner_email, contact_email)
VALUES ('Your Business', 'your-slug', 'wellness', 'owner@yourdomain.com', 'info@yourdomain.com');
```

## Multi-Tenant Architecture

Each deployment is scoped to a single tenant via the `TENANT_SLUG` environment variable. All database queries are filtered by `tenant_id`, so multiple tenants can share the same Supabase instance and API server safely. To onboard a new client, insert a tenant row and deploy a new Vercel project with their `TENANT_SLUG`.

## Admin Walkthrough

https://github.com/user-attachments/assets/79d25a97-625b-4dc2-8631-862cca6d2f43

## Screenshots

**Live site:** [the-wellness-co.onrender.com](https://the-wellness-co.onrender.com) · Fully responsive — adapted for mobile.

| **Home** | **About** |
|---|---|
| Hero, service cards, testimonials, and closing CTA | Practitioner bio, training certifications, and promise card |
| ![Home](docs/screenshots/wellnesscoindex.png) | ![About](docs/screenshots/wellnesscoaboutpage.png) |

| **Services** | **Book a Session** |
|---|---|
| Full service list with pricing and booking links | Multi-step booking flow with calendar, time slots, and Stripe checkout |
| ![Services](docs/screenshots/wellnesscoservicespage.png) | ![Book a Session](docs/screenshots/wellnesscobooksessionpage.png) |

| **Stories** | **FAQ** |
|---|---|
| Client testimonials with a featured quote banner | Accordion FAQ with expandable answers |
| ![Stories](docs/screenshots/wellnesscostoriespage.png) | ![FAQ](docs/screenshots/wellnesscofaqpage.png) |

| **Contact** | |
|---|---|
| Contact form with business hours and location info | |
| ![Contact](docs/screenshots/wellnesscocontactpage.png) | |

## Mobile

<table>
  <tr>
    <td valign="top"><img src="docs/screenshots/wellnesscomobileindexview.png" alt="Mobile Home" /></td>
    <td valign="top"><img src="docs/screenshots/wellnesscomobileaboutview.html.png" alt="Mobile About" /></td>
    <td valign="top"><img src="docs/screenshots/wellnesscomobileservicesview.html.png" alt="Mobile Services" /></td>
  </tr>
  <tr>
    <td valign="top"><img src="docs/screenshots/wellnesscomobileappointmentview.html.png" alt="Mobile Book a Session" /></td>
    <td valign="top"><img src="docs/screenshots/wellnesscomobilestoriesview.html.png" alt="Mobile Stories" /></td>
    <td valign="top"><img src="docs/screenshots/wellnesscomobilefaqview.html.png" alt="Mobile FAQ" /></td>
  </tr>
  <tr>
    <td valign="top"><img src="docs/screenshots/wellnesscomobilecontactview.html.png" alt="Mobile Contact" /></td>
    <td></td>
    <td></td>
  </tr>
</table>
