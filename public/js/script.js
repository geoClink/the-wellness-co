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