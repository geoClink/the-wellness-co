# The Wellness Co.

A full-stack booking website for a wellness and energy healing practice. Clients can browse services, select a date and time, and complete a booking through Stripe. Built as a learning project while transitioning from Swift/SwiftUI to web development.

## Stack

**Frontend**
- HTML, CSS, JavaScript (vanilla)
- Mobile-first responsive design
- Lighthouse scores: 98 Performance · 96 Accessibility · 100 SEO

**Backend**
- Node.js + Express
- Supabase (PostgreSQL) for the database
- Stripe for payment processing
- Resend for transactional email
- Helmet for security headers
- express-rate-limit for API protection

**Deployed on Render**

## Pages

| Page | Description |
|---|---|
| `index.html` | Home — hero, services grid, meet the practitioner, testimonial |
| `about.html` | Practitioner bio, training, certifications |
| `services.html` | Full service list with pricing and booking links |
| `appointments.html` | Booking flow — service, date, time, personal details |
| `contact.html` | Contact form |
| `faq.html` | FAQ accordion |
| `stories.html` | Client testimonials |
| `confirmation.html` | Post-booking confirmation page |

## API Routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/services` | Fetch all services |
| GET | `/api/availability?date=YYYY-MM-DD` | Available time slots for a date |
| POST | `/api/appointments` | Create a booking and initiate Stripe checkout |
| POST | `/api/contact` | Submit contact form |
| POST | `/api/webhook` | Stripe webhook handler |

## Local Setup

```bash
# Install dependencies
npm install

# Create a .env file with the following:
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=

# Start the server
node server.js
```

The server runs on `http://localhost:3000` by default.

## Environment Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `RESEND_API_KEY` | Resend API key for email |
