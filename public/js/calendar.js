// ==========================================
// DEDICATED NAMESPACED CALENDAR ENGINE
// ==========================================

let cl_currentDate = new Date();
let cl_selectedDate = null;
let cl_selectedTime = null; // 🌟 TRACKS ACTIVE SELECTED TIME
let cl_selectedServiceId = null; // 🌟 TRACKS AUTO-SELECTED REQ ID
let cl_availabilityRules = []; 

function cl_getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function cl_getFirstDayIndex(year, month) {
    return new Date(year, month, 1).getDay();
}

async function cl_initializeBookingPage() {
    console.log("🚀 Standalone Calendar initialization fired!");
    
    // Grab ?service= parameters out of the address bar right away
    const urlParams = new URLSearchParams(window.location.search);
    cl_selectedServiceId = urlParams.get('service');
    console.log("🎯 URL Target Service Found:", cl_selectedServiceId);

    try {
        const res = await fetch('/api/settings/availability');
        if (res.ok) {
            cl_availabilityRules = await res.json();
        }
    } catch (err) {
        console.error("❌ API Availability fetch failed:", err);
    }
    
    if (!cl_availabilityRules || cl_availabilityRules.length === 0) {
        cl_availabilityRules = [
            { day_of_week: 0, is_active: false }, 
            { day_of_week: 1, is_active: true, start_time: "09:00", end_time: "17:00" }, 
            { day_of_week: 2, is_active: true, start_time: "09:00", end_time: "17:00" }, 
            { day_of_week: 3, is_active: true, start_time: "09:00", end_time: "17:00" }, 
            { day_of_week: 4, is_active: true, start_time: "09:00", end_time: "17:00" }, 
            { day_of_week: 5, is_active: true, start_time: "09:00", end_time: "17:00" }, 
            { day_of_week: 6, is_active: false }  
        ];
    }

    await cl_renderServicePillsFallback();
    cl_buildCalendarGrid();
}

async function cl_renderServicePillsFallback() {
    const pillsContainer = document.getElementById("service-pills");
    if (!pillsContainer) return;
    
    try {
        const res = await fetch("/api/services");
        if (!res.ok) throw new Error("Could not load treatment list");
        const services = await res.json();
        
        if (!services || services.length === 0) {
            pillsContainer.innerHTML = `<p style="color:var(--muted);font-size:14px;">No services configured yet.</p>`;
            return;
        }

        // Check if our incoming URL parameter matches any database item IDs or slugs
        let activeIndex = services.findIndex(s => s.id === cl_selectedServiceId || s.slug === cl_selectedServiceId);
        
        // If no match was found, default gracefully back to the first pill index item
        if (activeIndex === -1) activeIndex = 0;

        pillsContainer.innerHTML = services.map((s, idx) => `
            <button type="button" class="service-pill ${idx === activeIndex ? 'active' : ''}" data-id="${s.id}" data-price="${s.price}" data-name="${s.name}" data-duration="${$.duration_minutes}">
                ${escapeHtml(s.name)} · $${s.price}
            </button>
        `).join('');

        // Populate summary box with the correct starting selection row details
        const startingService = services[activeIndex];
        const sumService = document.getElementById('sum-service');
        if (sumService) {
            sumService.textContent = `${startingService.name} · $${startingService.price}`;
            sumService.classList.add('has-value');
        }

        pillsContainer.querySelectorAll('.service-pill').forEach(pill => {
            pill.addEventListener('click', (e) => {
                e.preventDefault();
                pillsContainer.querySelectorAll('.service-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                
                const name = pill.dataset.name;
                const price = pill.dataset.price;
                if (sumService) {
                    sumService.textContent = `${name} · $${price}`;
                }
            });
        });

    } catch (err) {
        console.error("❌ Failed to pull active database service profiles:", err);
        pillsContainer.innerHTML = `
            <button type="button" class="service-pill active" data-id="default-session">General Healing Session · $120</button>
        `;
    }
}

function cl_buildCalendarGrid() {
    const daysContainer = document.getElementById('cal-days');
    const calMonthLabel = document.getElementById('cal-month');
    
    if (!daysContainer) return;

    const year = cl_currentDate.getFullYear();
    const month = cl_currentDate.getMonth();
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    if (calMonthLabel) {
        calMonthLabel.textContent = `${monthNames[month]} ${year}`;
    }

    const totalDays = cl_getDaysInMonth(year, month);
    const firstDayIndex = cl_getFirstDayIndex(year, month);

    let gridHtml = '';
    for (let i = 0; i < firstDayIndex; i++) {
        gridHtml += '<div class="cal-day empty"></div>';
    }

    const exactToday = new Date();
    exactToday.setHours(0, 0, 0, 0);

    for (let d = 1; d <= totalDays; d++) {
        const formattedMonth = String(month + 1).padStart(2, '0');
        const formattedDay = String(d).padStart(2, '0');
        const dateString = `${year}-${formattedMonth}-${formattedDay}`;
        
        const compareLoopDate = new Date(year, month, d, 0, 0, 0, 0);
        const dayOfWeek = compareLoopDate.getDay(); 
        
        const rule = cl_availabilityRules.find(r => r.day_of_week === dayOfWeek);
        const isClosed = rule ? !rule.is_active : true; 
        const isPast = compareLoopDate < exactToday;

        if (isClosed || isPast) {
            gridHtml += `<div class="cal-day disabled" data-date="${dateString}">${d}</div>`;
        } else {
            gridHtml += `<div class="cal-day clickable-day" data-date="${dateString}">${d}</div>`;
        }
    }

    daysContainer.innerHTML = gridHtml;
    
    document.querySelectorAll('.clickable-day').forEach(day => {
        day.addEventListener('click', async () => {
            document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
            day.classList.add('selected');
            cl_selectedDate = day.dataset.date;
            
            const currentDayNum = day.textContent;
            document.getElementById('sum-date').textContent = `${monthNames[month]} ${currentDayNum}`;
            document.getElementById('sum-date').classList.add('has-value');
            
            await cl_mockTimeSlotsForDate(cl_selectedDate);
        });
    });
}

async function cl_mockTimeSlotsForDate(dateStr) {
    const slotsContainer = document.getElementById('time-slots');
    if (!slotsContainer) return;

    const fallbackSlots = ["09:00 AM", "11:30 AM", "02:00 PM", "04:30 PM"];
    let slots = fallbackSlots;
    const activePill = document.querySelector('.service-pill.active');
    const duration = activePill ? activePill.dataset.duration : 60;

    try {
        const res = await fetch(`/api/availability?date=${dateStr}&duration=${duration}`);
        if (res.ok) {
            const data = await res.json();
            slots = data.available;
        }
    } catch (err) {
        console.error("Could not load availability:", err);
    }

    slotsContainer.innerHTML = slots.map(slot => `
        <button type="button" class="time-slot" data-time="${slot}">${slot}</button>
    `).join('');

    slotsContainer.querySelectorAll('.time-slot').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            slotsContainer.querySelectorAll('.time-slot').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            cl_selectedTime = btn.dataset.time;
            document.getElementById('sum-time').textContent = btn.textContent;
            document.getElementById('sum-time').classList.add('has-value');
        });
    });
}

document.getElementById('cal-prev')?.addEventListener('click', (e) => {
    e.preventDefault();
    cl_currentDate.setMonth(cl_currentDate.getMonth() - 1);
    cl_buildCalendarGrid();
});    

document.getElementById('cal-next')?.addEventListener('click', (e) => {
    e.preventDefault();
    cl_currentDate.setMonth(cl_currentDate.getMonth() + 1);
    cl_buildCalendarGrid();
});

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
// SINGLE AUTHENTICATED CHECKOUT SUBMISSION
// ==========================================
document.getElementById('booking-form')?.addEventListener('submit', async (e) => {
    e.preventDefault(); 

    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const telInput = document.getElementById('tel');

    let isValid = true;

    [nameInput, emailInput, telInput].forEach(input => {
        if (!input || !input.value.trim()) {
            input?.classList.add('error');
            isValid = false;
        } else {
            input?.classList.remove('error');
        }
    });

    const activeServiceButton = document.querySelector('.service-pill.active');
    const currentServiceId = activeServiceButton ? activeServiceButton.dataset.id : null;

    // 🌟 FIX: Checks our newly filled state tracker variables perfectly to avoid fake alert blocks
    if (!currentServiceId || !cl_selectedDate || !cl_selectedTime || !isValid) {
        alert("Please complete step 1 (Service), step 2 (Date & Time slot), and step 3 (Your Details) before checkout.");
        return;
    }

    const payload = {
        serviceId: currentServiceId,
        guestName: nameInput.value.trim(),
        email: emailInput.value.trim(),
        phone: telInput.value.trim(),
        date: cl_selectedDate,         
        time: cl_selectedTime,
        notes: document.getElementById('message')?.value || ''
    };

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Opening Stripe Secure Checkout…';
    }

    try {
        const res = await fetch('/api/appointments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) throw new Error("Server rejected booking payload constraints.");
        const data = await res.json();
        
        if (data.url) {
            window.location.href = data.url;
        } else {
            throw new Error("No checkout URL returned from the server.");
        }
    } catch (err) {
        console.error("❌ Checkout routing crash:", err);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Book & pay now';
        }
        const errDisplay = document.getElementById('booking-error');
        if (errDisplay) {
            errDisplay.textContent = 'Unable to open checkout connection. Please try again.';
            errDisplay.style.display = 'block';
        }
    }
});

cl_initializeBookingPage();