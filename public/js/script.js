async function loadServices() {
    const grid = document.getElementById("modalities-grid");
    if (!grid) return;

    const res = await fetch("/api/services");
    const services = await res.json();

    const tags = {
        "qhht": "Quantum Hypnosis",
        "cognomovement": "Nervous System",
        "biofield-tuning": "Sound Therapy",
        "acupuncture": "Traditional Medicine",
        "reiki": "Energy Healing"
    };

    grid.innerHTML = services.map(s => `
        <a href="appointments.html?service=${s.slug}" class="service-card">
        <span class="service-tag">${tags[s.slug] || s.name}</span>
        <span class="service-name">${s.name}</span>
        <span class="service-short">${s.description}</span>
        <span class="service-meta">${s.duration_minutes} min · <span class="service-price">$${s.price}</span></span>
        </a>
    `).join("");
}

loadServices();

document.querySelectorAll('.faq-question').forEach(button => {
    button.addEventListener('click', () => {
        const item = button.closest('.faq-item');
        const isOpen = item.classList.contains('open');

        document.querySelectorAll('.faq-item').forEach(i => {
            i.classList.remove('open');
            i.querySelector('.faq-icon').textContent = "+"
        });
        if (!isOpen) {
            item.classList.add('open');
            button.querySelector('.faq-icon').textContent = "×"
        }
    });
});

//Calender Logic

let currentDate = new Date();
let selectedServiceId = null;
let selectedDate = null;
let selectedTime = null;

function getDaysOfMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDay(year, month) {
    return new Date(year, month, 1).getDay();
}

async function loadServicePills() {
    const pillsContainer = document.getElementById("service-pills");
    if (!pillsContainer) return;

    const res = await fetch("/api/services");
    const services = await res.json();

    pillsContainer.innerHTML = services.map(s => `
        <button class="service-pill" data-id="${s.id}" data-price="${s.price}" data-slug="${s.slug}">${s.name} · $${s.price}</button>
        `).join("");

    pillsContainer.querySelectorAll('.service-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.service-pill').forEach(i => {
                i.classList.remove('active');
            })
            btn.classList.add('active');
            selectedServiceId = btn.dataset.id;
            document.getElementById('sum-service').textContent = btn.textContent;
            document.getElementById('sum-service').classList.add('has-value');
        });
    });

    const params = new URLSearchParams(window.location.search);
    const preselect = params.get('service');
    if (preselect) {
        const match = pillsContainer.querySelector(`[data-slug="${preselect}"]`);
        if (match) match.click();
    }
};

async function selectDate(day) {
    document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));

    day.classList.add('selected');

    selectedDate = day.dataset.date;

    const [year, month, dayNum] = selectedDate.split('-');
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    document.getElementById('sum-date').textContent = `${monthNames[month - 1]} ${parseInt(dayNum)}`;
    document.getElementById('sum-date').classList.add('has-value');

    const res = await fetch(`/api/availability?date=${selectedDate}`);
    const { available } = await res.json();


    const timeSlotsContainer = document.getElementById('time-slots');
    timeSlotsContainer.innerHTML = available.map(slot => `
        <button class="time-slot" data-time="${slot}">${slot}</button>
        `).join("");

    timeSlotsContainer.querySelectorAll('.time-slot').forEach(btn => {
        btn.addEventListener('click', () => {
            timeSlotsContainer.querySelectorAll('.time-slot').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            selectedTime = btn.dataset.time;
            document.getElementById('sum-time').textContent = selectedTime;
            document.getElementById('sum-time').classList.add('has-value');
        });
    });
};

async function renderCalendar() {
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

    for (let d = 1; d <= days; d++) {
        html += `<div class="cal-day" data-date="${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}">${d}</div>`
    }

    daysContainer.innerHTML = html;
    document.querySelectorAll('.cal-day:not(.empty)').forEach(day => {
        day.addEventListener('click', () => selectDate(day));
    });


    const calMonth = document.getElementById('cal-month');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    if (calMonth) calMonth.textContent = `${monthNames[month]} ${year}`;
}

document.getElementById('cal-prev')?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});    

document.getElementById('cal-next')?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1)
    renderCalendar();
});
    

loadServicePills();
renderCalendar();



document.getElementById('booking-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('tel').value.trim();

    let valid = true;

        ['name', 'email', 'tel'].forEach(id => {
            const input = document.getElementById(id);
            if (!input.value.trim()) {
                input.classList.add('error');
                valid = false;
            } else {
                input.classList.remove('error');
            }
        });

        if (!selectedServiceId || !selectedDate || !selectedTime || !valid) return;

    const payload = {
        service_id: selectedServiceId,
        guest_name: name,
        email: email,
        phone: phone,
        date: selectedDate,
        time: selectedTime,
        notes: document.getElementById('message').value
    };

    const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const { url } = await res.json();
    window.location.href = url;
});

['name', 'email', 'tel'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById(id).classList.remove('error');
    });
});

document.getElementById('contact-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const message = document.getElementById('message').value.trim();

    let valid = true;
    ['name', 'email', 'message'].forEach(id => {
        const input = document.getElementById(id);
        if (!input.value.trim()) {
            input.classList.add('error');
            valid = false;
        } else {
            input.classList.remove('error');
        }
    });
    
    if (!valid) return; 

    const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message })
    });

    const data = await res.json();
    if (data.success) {
        e.target.reset();
        alert('Message Sent! I\'ll be in touch soon.');
    }
});



//hamburger menu

document.getElementById('hamburger')?.addEventListener('click', () => {
    document.querySelector('nav').classList.toggle('open');
});