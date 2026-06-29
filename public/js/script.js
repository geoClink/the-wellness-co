// 🎯 ADD THIS TO THE ABSOLUTE TOP (LINE 1) OF public/js/script.js:

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

// ==========================================
// CALENDAR & AVAILABILITY LOGIC
// ==========================================

let currentDate = new Date();
let selectedServiceId = null;
let selectedDate = null;
let selectedTime = null;
let businessAvailabilityRules = []; 

// 🌟 CRITICAL FIX: Re-added the missing calculation helpers!
function getDaysOfMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDay(year, month) {
    return new Date(year, month, 1).getDay();
}

async function initializeBookingPage() {
    // 1. Fire off the availability rule fetch safely
    try {
        const res = await fetch('/api/settings/availability');
        if (res.ok) {
            businessAvailabilityRules = await res.json();
        }
    } catch (err) {
        console.error("Failed to fetch availability profiles:", err);
    }
    
    // 2. 🌟 FIXED: Load the service pills wrapped in their own try/catch block
    // This prevents a pill loading crash from killing your calendar generation!
    try {
        await loadServicePills();
    } catch (pillError) {
        console.error("Non-fatal: Could not load service pills:", pillError);
    }
    
    // 3. Render the calendar grid independently
    renderCalendar();
}

// 🎯 Ensure this function is inside public/js/script.js to populate services.html:
async function loadServices() {
    const grid = document.getElementById("modalities-grid");
    
    // 🌟 THE PROTECTION GUARD: If this element doesn't exist on the current page, exit safely without crashing!
    if (!grid) return; 

    grid.innerHTML = '<p style="color:var(--muted);font-size:14px;">Loading services…</p>';

    try {
        const res = await fetch("/api/services");
        if (!res.ok) throw new Error();
        const services = await res.json();
        
        // Render cards into the layout
        grid.innerHTML = services.map(s => `
            <a href="appointments.html?service=${s.slug}" class="service-card">
                <span class="service-name">${escapeHtml(s.name)}</span>
                <span class="service-short">${escapeHtml(s.description)}</span>
                <span class="service-meta">${s.duration_minutes} min · <span class="service-price">$${s.price}</span></span>
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
    if (!daysContainer) {
        console.error("❌ CRITICAL HTML ERROR: Could not find an element with id='cal-days' on this page!");
        return;
    }

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const days = getDaysOfMonth(year, month);
    const firstDay = getFirstDay(year, month);

    let html = '';
    
    // Create alignment spacing blocks
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="cal-day empty"></div>';
    }

    // Set time-agnostic midnight baseline parameters
    const exactToday = new Date();
    exactToday.setHours(0, 0, 0, 0);

    // Ensure our business availability rules array exists safely
    const activeRules = Array.isArray(businessAvailabilityRules) ? businessAvailabilityRules : [];

    for (let d = 1; d <= days; d++) {
        const formattedMonth = String(month + 1).padStart(2, '0');
        const formattedDay = String(d).padStart(2, '0');
        const dateString = `${year}-${formattedMonth}-${formattedDay}`;
        
        // Timezone-safe baseline instantiator string format syntax
        const compareLoopDate = new Date(`${year}/${formattedMonth}/${formattedDay} 00:00:00`);
        const dayOfWeek = compareLoopDate.getDay(); 
        
        // 🌟 FIXED: Fallback added. If database rules fail to fetch, default all days to open instead of crashing!
        const rule = activeRules.find(r => r.day_of_week === dayOfWeek);
        const isClosed = rule ? rule.is_active === false : false; 
        const isPast = compareLoopDate < exactToday;

        if (isClosed || isPast) {
            html += `<div class="cal-day disabled" data-date="${dateString}">${d}</div>`;
        } else {
            html += `<div class="cal-day" data-date="${dateString}">${d}</div>`;
        }
    }

    // Explicitly update DOM container string content tree
    daysContainer.innerHTML = html;
    
    // Attach listener triggers strictly to active display cells
    document.querySelectorAll('.cal-day:not(.empty):not(.disabled)').forEach(day => {
        day.addEventListener('click', () => selectDate(day));
    });

    const calMonth = document.getElementById('cal-month');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    if (calMonth) calMonth.textContent = `${monthNames[month]} ${year}`;
}

// ==========================================
// MOBILE HAMBURGER NAVIGATION TOGGLER
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.querySelector('nav');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Prevents instant bubbling close
            
            navMenu.classList.toggle('open');
            hamburger.classList.toggle('active');
        });

        // Safe UX touch: Close the menu if a user clicks anywhere outside of it
        document.addEventListener('click', (event) => {
            if (!navMenu.contains(event.target) && !hamburger.contains(event.target)) {
                navMenu.classList.remove('open');
                hamburger.classList.remove('active');
            }
        });
    }
});