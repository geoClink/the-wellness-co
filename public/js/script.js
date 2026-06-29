function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ==========================================
// CALENDAR & AVAILABILITY LOGIC
// ==========================================

let currentDate = new Date();
let selectedServiceId = null;
let selectedDate = null;
let selectedTime = null;
let businessAvailabilityRules = []; 

function getDaysOfMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDay(year, month) {
    return new Date(year, month, 1).getDay();
}

async function initializeBookingPage() {
    try {
        const res = await fetch('/api/settings/availability');
        if (res.ok) {
            businessAvailabilityRules = await res.json();
        }
    } catch (err) {
        console.error("Failed to fetch availability profiles:", err);
    }
    
    try {
        if (typeof loadServicePills === 'function') {
            await loadServicePills();
        }
    } catch (pillError) {
        console.error("Non-fatal: Could not load service pills:", pillError);
    }
    
    renderCalendar();
}

async function loadServices() {
    const grid = document.getElementById("modalities-grid");
    if (!grid) return; 

    grid.innerHTML = '<p style="color:var(--muted);font-size:14px;">Loading services…</p>';

    try {
        const res = await fetch("/api/services");
        if (!res.ok) throw new Error();
        const services = await res.json();
        
        grid.innerHTML = services.map(s => `
            <a href="appointments.html?service=${s.slug || s.id}" class="service-card">
                <span class="service-name">${escapeHtml(s.name)}</span>
                <span class="service-short">${escapeHtml(s.description)}</span>
                <span class="service-meta">${s.duration_minutes || '60'} min · <span class="service-price">$${s.price}</span></span>
            </a>
        `).join("");
        
    } catch (err) {
        grid.innerHTML = '<p style="color:var(--muted);font-size:14px;">Unable to load services. Please refresh the page.</p>';
    }
}

// Fire the loader call automatically
loadServices();

function renderCalendar() {
    const daysContainer = document.getElementById('cal-days');
    if (!daysContainer) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const days = getDaysOfMonth(year, month);
    const firstDay = getFirstDay(year, month);

    let html = '';
    
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="cal-day empty"></div>';
    }

    const exactToday = new Date();
    exactToday.setHours(0, 0, 0, 0);

    const activeRules = Array.isArray(businessAvailabilityRules) ? businessAvailabilityRules : [];

    for (let d = 1; d <= days; d++) {
        const formattedMonth = String(month + 1).padStart(2, '0');
        const formattedDay = String(d).padStart(2, '0');
        const dateString = `${year}-${formattedMonth}-${formattedDay}`;
        
        const compareLoopDate = new Date(`${year}/${formattedMonth}/${formattedDay} 00:00:00`);
        const dayOfWeek = compareLoopDate.getDay(); 
        
        const rule = activeRules.find(r => r.day_of_week === dayOfWeek);
        const isClosed = rule ? rule.is_active === false : false; 
        const isPast = compareLoopDate < exactToday;

        if (isClosed || isPast) {
            html += `<div class="cal-day disabled" data-date="${dateString}">${d}</div>`;
        } else {
            html += `<div class="cal-day" data-date="${dateString}">${d}</div>`;
        }
    }

    daysContainer.innerHTML = html;
    
    document.querySelectorAll('.cal-day:not(.empty):not(.disabled)').forEach(day => {
        day.addEventListener('click', () => {
            if (typeof selectDate === 'function') selectDate(day);
        });
    });

    const calMonth = document.getElementById('cal-month');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    if (calMonth) calMonth.textContent = `${monthNames[month]} ${year}`;
}

// ==========================================
// 🌟 PUBLIC STORIES & REVIEWS RENDERER
// ==========================================
async function loadPublicReviews() {
    const container = document.getElementById("testimonials-grid");
    if (!container) return; // Safely exit if we are not on stories.html

    try {
        const res = await fetch("/api/reviews");
        if (!res.ok) throw new Error("Failed to load reviews ledger");
        const reviews = await res.json();

        if (reviews.length === 0) {
            container.innerHTML = `<p style="color:var(--muted); font-size:15px;">No beautiful stories shared yet. Be the first!</p>`;
            return;
        }

        container.innerHTML = reviews.map(r => `
            <div class="testimonial">
                <blockquote>“${escapeHtml(r.body)}”</blockquote>
                <cite>— ${escapeHtml(r.name)} (${escapeHtml(String(r.rating))}/5 Stars)</cite>
            </div>
        `).join('');

    } catch (err) {
        console.error("❌ Failed to bind user reviews layout stream:", err);
    }
}

// ==========================================
// 🌟 HOMEPAGE DYNAMIC FEATURED QUOTE
// ==========================================
async function loadFeaturedQuoteOnHomepage() {
    const quoteElement = document.getElementById("featured-blockquote");
    const nameElement = document.getElementById("featured-name");
    const serviceElement = document.getElementById("featured-service");

    if (!quoteElement || !nameElement) return; // Safely exit if we are not on index.html

    try {
        const response = await fetch("/api/reviews/featured");
        if (!response.ok) return;
        
        const featuredReview = await response.json();

        if (featuredReview && featuredReview.body) {
            quoteElement.textContent = `“${featuredReview.body}”`;
            nameElement.textContent = featuredReview.name;
            if (serviceElement && featuredReview.rating) {
                serviceElement.textContent = `· Rated ${featuredReview.rating}/5 By Client`;
            }
        }
    } catch (err) {
        console.error("❌ Failed to bind active homepage testimonial asset:", err);
    }
}

// ==========================================
// MOBILE HAMBURGER NAVIGATION TOGGLER
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Fire off all async layout data components upon boot initialization
    loadPublicReviews();
    loadFeaturedQuoteOnHomepage();
    if (document.getElementById('cal-days')) {
        initializeBookingPage();
    }

    const hamburger = document.getElementById('hamburger');
    const navMenu = document.querySelector('nav');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); 
            
            navMenu.classList.toggle('open');
            hamburger.classList.toggle('active');
        });

        document.addEventListener('click', (event) => {
            if (!navMenu.contains(event.target) && !hamburger.contains(event.target)) {
                navMenu.classList.remove('open');
                hamburger.classList.remove('active');
            }
        });
    }
});

async function renderDynamicFooterContent() {
    try {
        const res = await fetch("/api/settings/footer");
        if (!res.ok) return;
        const data = await res.json();

        const bioEl = document.getElementById("live-footer-bio");
        const emailEl = document.getElementById("live-footer-email");
        const phoneEl = document.getElementById("live-footer-phone");
        const addressEl = document.getElementById("live-footer-address");

        if (bioEl && data.footer_bio) bioEl.textContent = data.footer_bio;
        
        if (emailEl && data.footer_email) {
            emailEl.textContent = data.footer_email;
            emailEl.href = `mailto:${data.footer_email}`;
        }
        
        if (phoneEl && data.footer_phone) {
            phoneEl.textContent = data.footer_phone;
            phoneEl.href = `tel:${data.footer_phone.replace(/\D/g,'')}`;
        }
        
        if (addressEl && data.footer_address) {
            addressEl.textContent = data.footer_address;
        }
    } catch (err) {
        console.error("Footer template asset sync failure:", err);
    }
}

// Fire automatically inside your script initialization block:
document.addEventListener("DOMContentLoaded", renderDynamicFooterContent);