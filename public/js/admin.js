// Helper to sanitize HTML output and block XSS
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;'); // Safe escaping for single quotes in templates
}

// Global state tracking for auth session
const isDemo = localStorage.getItem('demo_mode') === 'true';

// Auto-login when arriving via ?demo param (e.g. from a portfolio link)
(async function checkDemoParam() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true') {
        try {
            const res = await fetch('/api/demo-login');
            if (res.ok) {
                const data = await res.json();
                localStorage.setItem('admin_token', data.token);
                localStorage.setItem('demo_mode', 'true');
                history.replaceState(null, '', window.location.pathname);
                showDashboard();
                return;
            }
        } catch (err) {
            console.error("Demo auto-login failed:", err);
        }
    }
    const token = localStorage.getItem('admin_token');
    if (token) {
        showDashboard();
    } else {
        showLogin();
    }
})();

document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).style.display = 'block';
    });
});

async function loadContacts() {
    const currentToken = localStorage.getItem('admin_token');
    const res = await fetch('/api/contact', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
    });

    const contacts = await res.json();
    const tbody = document.getElementById('contact-body');
    if (!tbody) return;

    tbody.innerHTML = contacts.map(c => `
        <tr>
            <td>${escapeHtml(c.name)}</td>
            <td>${escapeHtml(c.email)}</td>
            <td>${escapeHtml(c.subject)}</td>
            <td>${escapeHtml(c.message)}</td>
            <td>${c.read ? 'Read' : 'Unread'}</td>
            <td>
                ${!c.read ? `<button onclick="markContactRead('${escapeHtml(c.id)}')">Mark as Read</button>` : ''}
            </td>
        </tr>
    `).join('');
}

function showLogin() {
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');

    if (loginView) loginView.style.display = 'block';
    if (dashboardView) dashboardView.style.display = 'none';
}

function showDashboard() {
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'block';

    // Core Data Fetch Operations
    loadBookings();
    loadContacts();
    loadAdminReviews();
    loadHeroContent();
    loadAdminServices();
    loadBusinessProfile();
    loadAboutContent();
    loadBlockedDates();
    loadAvailabilitySettings();
    loadIntegrationSettings();

    if (isDemo) applyDemoMode();
}

function applyDemoMode() {
    document.body.classList.add('demo-mode');

    const banner = document.createElement('div');
    banner.id = 'demo-banner';
    banner.style.cssText = `
        background: #5f6e52; color: #fff; text-align: center;
        padding: 10px 20px; font-size: 14px; font-family: inherit;
        position: sticky; top: 0; z-index: 999; letter-spacing: 0.02em;
    `;
    banner.innerHTML = `<strong>Demo Mode</strong> &mdash; You are viewing a live read-only preview. All actions are disabled.`;
    document.body.prepend(banner);

    document.querySelectorAll('button:not(#logout-btn):not(.admin-tab), input[type="submit"]').forEach(btn => {
        btn.disabled = true;
        btn.title = 'Disabled in demo mode';
        btn.style.opacity = '0.45';
        btn.style.cursor = 'not-allowed';
    });
}

function showDemoToast() {
    let toast = document.getElementById('demo-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'demo-toast';
        toast.style.cssText = `
            position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
            background: #2c2823; color: #fff; padding: 12px 28px; border-radius: 8px;
            font-size: 14px; font-family: inherit; z-index: 9999;
            transition: opacity 0.3s; pointer-events: none;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = 'Actions are disabled in demo mode.';
    toast.style.opacity = '1';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

function demoGuard() {
    if (!isDemo) return false;
    showDemoToast();
    return true;
}
// ==========================================
// 1. AUTHENTICATION HANDLERS
// ==========================================

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value.trim();
        const password = document.getElementById('admin-password').value;

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!res.ok) {
                alert('Invalid email or password.');
                return;
            }

            const data = await res.json();
            localStorage.setItem('admin_token', data.token);
            if (data.isDemo) localStorage.setItem('demo_mode', 'true');
            else localStorage.removeItem('demo_mode');
            showDashboard();
        } catch (err) {
            console.error("Network error during login:", err);
            alert("Could not connect to the authentication server.");
        }
    });
}

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('demo_mode');
        showLogin();
    });
}

// ==========================================
// PASSWORD RESET FLOW
// ==========================================

// On page load, check if we arrived via a reset email link
(function checkRecoveryToken() {
    const hash = new URLSearchParams(window.location.hash.replace('#', '?'));
    const type = hash.get('type');
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');

    if (type === 'recovery' && accessToken) {
        showLogin();
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('new-password-form').style.display = '';
        // Store tokens temporarily for the update call
        document.getElementById('new-password-form').dataset.accessToken = accessToken;
        document.getElementById('new-password-form').dataset.refreshToken = refreshToken || '';
        // Clean up URL
        history.replaceState(null, '', window.location.pathname);
    }
})();

document.getElementById('show-reset-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('reset-request-form').style.display = '';
});

document.getElementById('back-to-login-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('reset-request-form').style.display = 'none';
    document.getElementById('login-form').style.display = '';
});

document.getElementById('reset-request-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reset-email').value;
    const msg = document.getElementById('reset-request-msg');

    const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });

    if (res.ok) {
        msg.style.color = 'green';
        msg.textContent = 'Reset link sent — check your email.';
    } else {
        msg.style.color = 'red';
        msg.textContent = 'Something went wrong. Try again.';
    }
});

document.getElementById('new-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = document.getElementById('new-password-form');
    const password = document.getElementById('new-password').value;
    const msg = document.getElementById('new-password-msg');

    const res = await fetch('/api/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            password,
            accessToken: form.dataset.accessToken,
            refreshToken: form.dataset.refreshToken
        })
    });

    if (res.ok) {
        msg.style.color = 'green';
        msg.textContent = 'Password updated! Redirecting to login…';
        setTimeout(() => {
            form.style.display = 'none';
            document.getElementById('login-form').style.display = '';
        }, 1500);
    } else {
        const data = await res.json();
        msg.style.color = 'red';
        msg.textContent = data.error || 'Failed to update password.';
    }
});


// ==========================================
// 2. WEBSITE CUSTOMIZER (HERO SECTION)
// ==========================================

async function markContactRead(id) {
    if (demoGuard()) return;
    const currentToken = localStorage.getItem('admin_token');
    await fetch(`/api/contact/${id}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    loadContacts();
}
async function loadHeroContent() {
    try {
        const res = await fetch('/api/settings/hero');
        if (res.ok) {
            const data = await res.json();
            const titleEl = document.getElementById('hero-title');
            const descEl = document.getElementById('hero-desc');
            const imgLabel = document.getElementById('current-image-url');

            if (titleEl) titleEl.value = data.title || '';
            if (descEl) descEl.value = data.description || ''; // 🌟 Dynamic Tracking
            if (imgLabel && data.imageUrl) {
                imgLabel.textContent = `Active file link: ${data.imageUrl.split('/').pop()}`;
            }
        }
    } catch (err) {
        console.error("Failed to load hero configurations:", err);
    }
}

const heroForm = document.getElementById('hero-form');
if (heroForm) {
    heroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (demoGuard()) return;
        const currentToken = localStorage.getItem('admin_token');
        const statusEl = document.getElementById('hero-status');
        const fileInput = document.getElementById('hero-image-file');

        let heroImageUrl = undefined;

        if (fileInput && fileInput.files[0]) {
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            const uploadRes = await fetch('/api/upload/site-image', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${currentToken}` },
                body: formData
            });
            const uploadData = await uploadRes.json();
            if (!uploadRes.ok) {
                if (statusEl) statusEl.textContent = "Image upload failed.";
                return;
            }
            heroImageUrl = uploadData.url;
        }

        const payload = {
            hero_heading: document.getElementById('hero-title').value.trim(),
            hero_subtext: document.getElementById('hero-desc').value.trim()
        };

        if (heroImageUrl) payload.hero_image_url = heroImageUrl;

        const res = await fetch('/api/site-settings', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            if (statusEl) statusEl.textContent = "Saved successfully!";
            loadHeroContent();
            if (statusEl) setTimeout(() => statusEl.textContent = "", 3000);
        } else {
            alert("Failed to save hero content.");
        }
    });
}


// ==========================================
// 3. SERVICES & PROFILE PROFILE MANAGEMENT
// ==========================================

async function loadAdminServices() {
    try {
        const res = await fetch('/api/services');
        if (!res.ok) return;
        const services = await res.json();
        const tbody = document.getElementById('services-body');
        if (!tbody) return;

        if (services.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No catalog treatment options created yet.</td></tr>';
            return;
        }

        tbody.innerHTML = services.map(s => `
            <tr id="service-row-${s.id}">
                <td>${escapeHtml(s.name)}</td>
                <td>${escapeHtml(s.description)}</td>
                <td>$${escapeHtml(String(s.price))}</td>
                <td>
                    <div class="table-actions">
                        <button class="delete-service-btn" data-id="${escapeHtml(s.id)}">Delete</button>
                        <button
                            data-id="${s.id}"
                            data-name="${escapeHtml(s.name)}"
                            data-desc="${escapeHtml(s.description)}"
                            data-price="${s.price}"
                            onclick="editServiceRow(this.dataset.id, this.dataset.name, this.dataset.desc, this.dataset.price)"
                        >Edit</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error("Failed to map dynamic treatment items:", err);
    }
}

function editServiceRow(id, name, description, price) {
    const row = document.getElementById(`service-row-${id}`);
    row.innerHTML = `
    <td><input type="text" id="edit-name-${id}" value="${escapeHtml(name)}" style="width:100%;"></td>
    <td><input type="text" id="edit-desc-${id}" value="${escapeHtml(description)}" style="width:100%;"></td>
     <td><input type="text" id="edit-price-${id}" value="${price}" style="width:80px;"></td>
        <td>
            <button onclick="saveServiceEdit('${id}')">Save</button>
            <button onclick="loadAdminServices()">Cancel</button>
        </td>
    `;
}

async function saveServiceEdit(id) {
    if (demoGuard()) return;
    const currentToken = localStorage.getItem('admin_token');
    const name = document.getElementById(`edit-name-${id}`).value;
    const description = document.getElementById(`edit-desc-${id}`).value;
    const price = document.getElementById(`edit-price-${id}`).value;

    const res = await fetch(`/api/services/admin/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({ name, description, price })
    });

    if (res.ok) loadAdminServices();
}

async function loadBusinessProfile() {
    try {
        const res = await fetch('/api/settings/profile');
        if (res.ok) {
            const data = await res.json();
            const phoneEl = document.getElementById('biz-phone');
            const wkdayEl = document.getElementById('biz-hours-wkday');
            const wkndEl = document.getElementById('biz-hours-wknd');

            if (phoneEl) phoneEl.value = data.phone || '';
            if (wkdayEl) wkdayEl.value = data.business_hours?.mon_fri || '';
            if (wkndEl) wkndEl.value = data.business_hours?.sat_sun || '';
        }
    } catch (err) {
        console.error("Failed to load business profile details:", err);
    }
}

const bizProfileForm = document.getElementById('business-profile-form');
if (bizProfileForm) {
    bizProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (demoGuard()) return;
        const currentToken = localStorage.getItem('admin_token');
        const statusEl = document.getElementById('profile-status');

        const payload = {
            phone: document.getElementById('biz-phone').value.trim(),
            hours: {
                mon_fri: document.getElementById('biz-hours-wkday').value.trim(),
                sat_sun: document.getElementById('biz-hours-wknd').value.trim()
            }
        };

        const res = await fetch('/api/settings/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            if (statusEl) statusEl.textContent = "Profile updated successfully!";
            if (statusEl) setTimeout(() => statusEl.textContent = "", 3000);
        }
    });
}

const addServiceForm = document.getElementById('add-service-form');
if (addServiceForm) {
    addServiceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (demoGuard()) return;
        const currentToken = localStorage.getItem('admin_token');
        const title = document.getElementById('service-title').value.trim();
        const description = document.getElementById('service-desc').value.trim();
        const price = document.getElementById('service-price').value.trim();

        const res = await fetch('/api/services/admin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ title, description, price })
        });

        if (res.ok) {
            e.target.reset();
            loadAdminServices();
        } else {
            alert("Could not commit new treatment asset profile.");
        }
    });
}

const servicesBody = document.getElementById('services-body');
if (servicesBody) {
    servicesBody.addEventListener('click', async (e) => {
        if (!e.target.classList.contains('delete-service-btn')) return;
        if (demoGuard()) return;
        if (!confirm('Permanently wipe out this active service profile?')) return;

        const currentToken = localStorage.getItem('admin_token');
        const id = e.target.dataset.id;

        const res = await fetch(`/api/services/admin/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (res.ok) loadAdminServices();
    });
}


// ==========================================
// 4. BOOKINGS MANAGEMENT
// ==========================================

async function loadBookings() {
    const currentToken = localStorage.getItem('admin_token');
    const res = await fetch('/api/appointments', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
    });

    if (res.status === 401) {
        localStorage.removeItem('admin_token');
        showLogin();
        return;
    }

    const bookings = await res.json();
    const tbody = document.getElementById('bookings-body');
    if (!tbody) return;

    tbody.innerHTML = bookings.map(b => `
        <tr>
            <td>${escapeHtml(b.date)}</td>
            <td>${escapeHtml(b.time)}</td>
            <td>${escapeHtml(b.guest_name)}</td>
            <td>${escapeHtml(b.email)}</td>
            <td>${escapeHtml(b.phone || '-')}</td>
            <td>${escapeHtml(b.status)}</td>
            <td>
                <div class="table-actions">
                    <button class="delete-service-btn" onclick="adminCancelAndRefund('${escapeHtml(b.id)}')">Cancel & Refund</button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function updateStatus(id, status) {
    if (demoGuard()) return;
    const currentToken = localStorage.getItem('admin_token');
    await fetch(`/api/appointments/${id}/status`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({ status })
    });
    loadBookings();
}

async function adminCancelAndRefund(id) {
    if (demoGuard()) return;
    if (!confirm('Cancel this appointment and issue a full refund to the client?')) return;

    const currentToken = localStorage.getItem('admin_token');
    const res = await fetch(`/api/admin/appointments/${id}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentToken}` }
    });

    const data = await res.json();
    if (res.ok) {
        alert(data.refunded
            ? 'Appointment cancelled and full refund issued.'
            : 'Appointment cancelled (no payment on record to refund).'
        );
        loadBookings();
    } else {
        alert('Error: ' + data.error);
    }
}


// ==========================================
// 5. TESTIMONIAL / REVIEWS MANAGEMENT
// ==========================================

async function loadAdminReviews() {
    const currentToken = localStorage.getItem('admin_token');
    const res = await fetch('/api/admin/reviews', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (!res.ok) return;
    const reviews = await res.json();
    const tbody = document.getElementById('reviews-body');
    if (!tbody) return;

    if (reviews.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No reviews yet.</td></tr>';
        return;
    }
    // 🎯 UPDATE THIS template block inside loadAdminReviews():
    tbody.innerHTML = reviews.map(r => `
    <tr>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(String(r.rating))}/5</td>
        <td>${escapeHtml(r.body)}</td>
        <td>${r.approved ? 'Approved' : 'Pending'}</td>
        <td>
            <div class="table-actions">
                <button
                    class="btn-feature ${r.is_featured ? 'active' : ''}"
                    onclick="toggleFeaturedReview('${escapeHtml(r.id)}')">
                    ${r.is_featured ? '★ Featured' : '☆ Make Featured'}
                </button>
                ${!r.approved ? `<button onclick="approveReview('${escapeHtml(r.id)}')">Approve</button>` : ''}
                <button onclick="deleteReview('${escapeHtml(r.id)}')">Delete</button>
            </div>
        </td>
    </tr>
`).join('');
}

async function approveReview(id) {
    if (demoGuard()) return;
    const currentToken = localStorage.getItem('admin_token');
    const res = await fetch(`/api/reviews/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (res.ok) loadAdminReviews();
}

async function deleteReview(id) {
    if (demoGuard()) return;
    const currentToken = localStorage.getItem('admin_token');
    const res = await fetch(`/api/reviews/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (res.ok) loadAdminReviews();
}

// 🎯 ADD THIS new function inside Section 5:
async function toggleFeaturedReview(id) {
    if (demoGuard()) return;
    const currentToken = localStorage.getItem('admin_token');

    try {
        const res = await fetch(`/api/reviews/${id}/feature`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (res.ok) {
            // Re-pull and update the reviews table layout view immediately
            loadAdminReviews();
        } else {
            alert("Failed to update featured testimonial state constraints.");
        }
    } catch (err) {
        console.error("❌ Review featuring connection failure:", err);
    }
}

const addReviewForm = document.getElementById('add-review-form');
if (addReviewForm) {
    addReviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (demoGuard()) return;
        const currentToken = localStorage.getItem('admin_token');
        const name = document.getElementById('review-name').value.trim();
        const rating = document.getElementById('review-rating').value;
        const body = document.getElementById('review-body').value.trim();

        const res = await fetch('/api/admin/reviews', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ name, rating, body })
        });

        const successEl = document.getElementById('review-success');
        const errorEl = document.getElementById('review-error');

        if (res.ok) {
            e.target.reset();
            if (successEl) successEl.style.display = 'block';
            if (errorEl) errorEl.style.display = 'none';
            if (successEl) setTimeout(() => successEl.style.display = 'none', 3000);
            loadAdminReviews();
        } else {
            const data = await res.json();
            if (errorEl) {
                errorEl.textContent = data.error || 'Something went wrong.';
                errorEl.style.display = 'block';
            }
            if (successEl) successEl.style.display = 'none';
        }
    });
}

// Add inside your showDashboard() bootstrap stack: loadFooterContent();

async function loadFooterContent() {
    const res = await fetch('/api/settings/footer');
    if (res.ok) {
        const data = await res.json();
        document.getElementById('footer-bio-input').value = data.footer_bio || '';
        document.getElementById('footer-email-input').value = data.footer_email || '';
        document.getElementById('footer-phone-input').value = data.footer_phone || '';
        document.getElementById('footer-address-input').value = data.footer_address || '';
    }
}

document.getElementById('footer-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (demoGuard()) return;
    const token = localStorage.getItem('admin_token');
    const statusEl = document.getElementById('footer-status');

    const payload = {
        bio: document.getElementById('footer-bio-input').value.trim(),
        email: document.getElementById('footer-email-input').value.trim(),
        phone: document.getElementById('footer-phone-input').value.trim(),
        address: document.getElementById('footer-address-input').value.trim()
    };

    const res = await fetch('/api/settings/footer', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        statusEl.textContent = "Footer updated successfully!";
        setTimeout(() => statusEl.textContent = "", 3000);
    }
});

// 🎯 Add inside your settings load sequence inside public/js/admin.js
// ==========================================
// INTEGRATIONS & GATEWAYS HANDLERS
// ==========================================

// Fetch existing keys to populate the form on dashboard load
async function loadIntegrationSettings() {
    try {
        const res = await fetch('/api/settings/integrations', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
        });
        if (res.ok) {
            const data = await res.json();
            if (document.getElementById('stripe-pub-key')) document.getElementById('stripe-pub-key').value = data.stripe_publishable_key || '';
            if (document.getElementById('stripe-sec-key')) document.getElementById('stripe-sec-key').value = data.stripe_secret_key || '';
            if (document.getElementById('stripe-wh-key')) document.getElementById('stripe-wh-key').value = data.stripe_webhook_secret || '';
            if (document.getElementById('resend-api-key')) document.getElementById('resend-api-key').value = data.resend_api_key || '';
        }
    } catch (err) {
        console.error("Failed to load integrations setup fields:", err);
    }
}

// Form submit listener to save keys to Supabase
const integrationsForm = document.getElementById('integrations-form');
if (integrationsForm) {
    integrationsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (demoGuard()) return;
        const token = localStorage.getItem('admin_token');
        const statusEl = document.getElementById('gateway-status');

        const payload = {
            stripe_pub: document.getElementById('stripe-pub-key').value.trim(),
            stripe_sec: document.getElementById('stripe-sec-key').value.trim(),
            stripe_wh: document.getElementById('stripe-wh-key').value.trim(),
            resend_key: document.getElementById('resend-api-key').value.trim()
        };

        const res = await fetch('/api/settings/integrations', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            if (statusEl) {
                statusEl.textContent = "All gateway integrations updated successfully!";
                setTimeout(() => statusEl.textContent = "", 3000);
            }
            loadIntegrationSettings();
        } else {
            alert("Failed to update system gateways.");
        }
    });
}

// Add inside your dashboard initializers: loadAvailabilitySettings();

const daysMapping = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Ensure this function matches exactly in public/admin.js
async function loadAvailabilitySettings() {
    const tbody = document.getElementById('availability-rows');
    if (!tbody) {
        console.error("❌ DOM element 'availability-rows' not found in HTML!");
        return;
    }

    const daysMapping = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    try {
        const res = await fetch('/api/settings/availability');

        // Safe check: handle potential empty database tables or failed calls
        let rules = [];
        if (res.ok) {
            rules = await res.json();
        } else {
            console.warn("⚠️ API fallback activated. Generating raw scheduling defaults.");
        }

        // Helper to generate explicit time selections safely
        const generateTimeOptions = (selectedTime) => {
            let optionsHtml = '';
            // Handle fallbacks if database time string arrives formatted oddly
            const currentSelected = selectedTime ? selectedTime.substring(0, 5) : "";

            for (let hour = 0; hour < 24; hour++) {
                for (let min of ['00', '30']) {
                    const formattedHour = String(hour).padStart(2, '0');
                    const timeValue = `${formattedHour}:${min}`;

                    const ampm = hour >= 12 ? 'PM' : 'AM';
                    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
                    const displayLabel = `${displayHour}:${min} ${ampm}`;

                    const isSelected = timeValue === currentSelected ? 'selected' : '';
                    optionsHtml += `<option value="${timeValue}" ${isSelected}>${displayLabel}</option>`;
                }
            }
            return optionsHtml;
        };

        // Re-draw rows and insert them explicitly into the DOM element view
        tbody.innerHTML = daysMapping.map((day, index) => {
            // Safe array extraction with absolute default rollbacks
            const currentRule = (Array.isArray(rules) ? rules : []).find(r => r.day_of_week === index) || {
                start_time: "09:00", end_time: "17:00", is_active: true
            };

            return `
                <tr data-day="${index}" style="border-bottom: 1px solid #eee; text-align: left;">
                    <td style="padding: 12px 10px; font-weight: 500; color: var(--text);">${day}</td>
                    <td style="padding: 12px 10px;">
                        <input type="checkbox" class="avail-active" ${currentRule.is_active ? 'checked' : ''}> Open
                    </td>
                    <td style="padding: 12px 10px;">
                        <select class="avail-start" style="padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-family: inherit;">
                            ${generateTimeOptions(currentRule.start_time)}
                        </select>
                    </td>
                    <td style="padding: 12px 10px;">
                        <select class="avail-end" style="padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-family: inherit;">
                            ${generateTimeOptions(currentRule.end_time)}
                        </select>
                    </td>
                    <td style="padding: 12px 10px;">
                    <select class="avail-break-start" style="padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-family: inherit;">
                    <option value="">None</option>
                        ${generateTimeOptions(currentRule.break_start)}
                        </select>
                        </td>
                        <td style="padding: 12px 10px;">
                    <select class="avail-break-end" style="padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-family: inherit;">
                    <option value="">None</option>
                        ${generateTimeOptions(currentRule.break_end)}
                        </select>
                        </td>

                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("❌ Critical exception during scheduling rendering operation:", err);
    }
}

async function loadBlockedDates() {
    const token = localStorage.getItem('admin_token');
    const res = await fetch('/api/blocked-dates', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const dates = await res.json();
    const tbody = document.getElementById('blocked-dates-list');
    if (!tbody) return;

    tbody.innerHTML = dates.length ? dates.map(d => `
        <tr>
        <td>${escapeHtml(d.date)}</td>
        <td>${escapeHtml(d.reason || '-')}</td>
        <td><button onclick="removeBlockedDate('${escapeHtml(d.id)}')">Remove</button></td>
        </tr>
        `).join('') : '<tr><td colspan="3">No Blocked dates.</td></tr>';
}

async function removeBlockedDate(id) {
    if (demoGuard()) return;
    const token = localStorage.getItem('admin_token');
    await fetch(`/api/blocked-dates/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    loadBlockedDates();
}

document.getElementById('blocked-date-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (demoGuard()) return;
    const token = localStorage.getItem('admin_token');
    const date = document.getElementById('blocked-date-input').value;
    const reason = document.getElementById('blocked-reason-input').value;
    await fetch('/api/blocked-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ date, reason })
    });
    e.target.reset();
    loadBlockedDates();
});

const availForm = document.getElementById('availability-form');
if (availForm) {
    availForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (demoGuard()) return;
        const currentToken = localStorage.getItem('admin_token');
        const statusEl = document.getElementById('avail-status');

        const rulesArray = [];
        document.querySelectorAll('#availability-rows tr').forEach(row => {
            rulesArray.push({
                day_of_week: row.dataset.day,
                is_active: row.querySelector('.avail-active').checked,
                start_time: row.querySelector('.avail-start').value,
                end_time: row.querySelector('.avail-end').value,
                break_start: row.querySelector('.avail-break-start').value,
                break_end: row.querySelector('.avail-break-end').value,
            });
        });

        const res = await fetch('/api/settings/availability', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ rules: rulesArray })
        });

        if (res.ok) {
            if (statusEl) statusEl.textContent = "Availability profiles synced successfully!";
            loadAvailabilitySettings();
            if (statusEl) setTimeout(() => statusEl.textContent = "", 3000);
        }
    });
}

// ==========================================
// 6. WEBSITE CUSTOMIZER (ABOUT PAGE)
// ==========================================

async function loadAboutContent() {
    try {
        const res = await fetch('/api/settings/about');
        if (res.ok) {
            const data = await res.json();
            const headingEl = document.getElementById('about-heading');
            const bodyEl = document.getElementById('about-body');

            if (headingEl) headingEl.value = data.heading || '';
            if (bodyEl) bodyEl.value = data.body || '';
        }
    } catch (err) {
        console.error("Failed to load about settings:", err);
    }
}

const aboutForm = document.getElementById('about-form');
if (aboutForm) {
    aboutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (demoGuard()) return;
        const currentToken = localStorage.getItem('admin_token');
        const statusEl = document.getElementById('about-status');
        const fileInput = document.getElementById('about-image-file');

        let aboutImageUrl = undefined;

        if (fileInput.files[0]) {
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            const uploadRes = await fetch('/api/upload/site-image', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${currentToken}` },
                body: formData
            });
            const uploadData = await uploadRes.json();
            if (!uploadRes.ok) {
                if (statusEl) statusEl.textContent = "Image upload failed.";
                return;
            }
            aboutImageUrl = uploadData.url;
        }

        const payload = {
            about_heading: document.getElementById('about-heading').value.trim(),
            about_body: document.getElementById('about-body').value.trim()
        };

        if (aboutImageUrl) payload.about_image_url = aboutImageUrl;

        const res = await fetch('/api/site-settings', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            if (statusEl) statusEl.textContent = "About page saved successfully!";
            loadAboutContent();
            if (statusEl) setTimeout(() => statusEl.textContent = "", 3000);
        } else {
            alert("Failed to update About page settings.");
        }
    });
}