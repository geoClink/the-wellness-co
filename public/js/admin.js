// Helper to sanitize HTML output and block XSS
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;'); // Safe escaping for single quotes in templates
}

// Global state tracking for auth session
const token = localStorage.getItem('admin_token');

// Application Bootstrapper
if (token) {
    showDashboard();
}

function showDashboard() {
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'block';
    
    // Core Data Fetch Operations
    loadBookings();
    loadAdminReviews();
    loadHeroContent();     // NEW: Fetch hero settings from Supabase
    loadAdminServices();   // NEW: Fetch customizable services menu
}

function showLogin() {
    document.getElementById('login-view').style.display = 'block';
    document.getElementById('dashboard-view').style.display = 'none';
}

// ==========================================
// 1. AUTHENTICATION HANDLERS
// ==========================================

// Handle Login Submission
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;

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
    showDashboard();
});

// Logout Request
document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('admin_token');
    showLogin();
});


// ==========================================
// 2. NEW: WEBSITE CUSTOMIZER (HERO SECTION)
// ==========================================

// Fetch active hero options from your settings endpoint
async function loadHeroContent() {
    try {
        const res = await fetch('/api/settings/hero');
        if (res.ok) {
            const data = await res.json();
            document.getElementById('hero-title').value = data.title || '';
            const imgLabel = document.getElementById('current-image-url');
            if (imgLabel && data.imageUrl) {
                imgLabel.textContent = `Active file link: ${data.imageUrl.split('/').pop()}`;
            }
        }
    } catch (err) {
        console.error("Failed to load hero configurations:", err);
    }
}

// Process Hero updates using multipart/form-data for file stream transfers
document.getElementById('hero-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentToken = localStorage.getItem('admin_token');
    const statusEl = document.getElementById('hero-status');

    // Pack standard strings alongside binary data buffers using FormData
    const formData = new FormData();
    formData.append('title', document.getElementById('hero-title').value.trim());
    
    const fileInput = document.getElementById('hero-image-file');
    if (fileInput.files[0]) {
        formData.append('heroImage', fileInput.files[0]);
    }

    const res = await fetch('/api/settings/hero', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${currentToken}` },
        body: formData // Let browser auto-configure boundary content headers
    });

    if (res.ok) {
        statusEl.textContent = "Saved successfully!";
        fileInput.value = ""; 
        loadHeroContent();
        setTimeout(() => statusEl.textContent = "", 3000);
    } else {
        alert("Failed to sync hero asset update configurations.");
    }
});


// ==========================================
// 3. NEW: SERVICES MENU MANAGEMENT
// ==========================================

// Get and construct your public menu items dynamically
async function loadAdminServices() {
    try {
        const res = await fetch('/api/services');
        if (!res.ok) return;
        const services = await res.json();
        const tbody = document.getElementById('services-body');
        
        if (services.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No catalog treatment options created yet.</td></tr>';
            return;
        }

       tbody.innerHTML = services.map(s => `
    <tr>
        <td>${escapeHtml(s.name)}</td>   <td>${escapeHtml(s.description)}</td>
        <td>${escapeHtml(s.price)}</td>
        <td>
            <button class="delete-service-btn" data-id="${escapeHtml(s.id)}">Delete</button>
        </td>
    </tr>
`).join('');
    } catch (err) {
        console.error("Failed to map dynamic treatment items:", err);
    }
}

// Create Service Form Submission Interceptor
document.getElementById('add-service-form').addEventListener('submit', async (e) => {
    e.preventDefault();
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

// Delete click interceptor delegation tracking
document.getElementById('services-body').addEventListener('click', async (e) => {
    if (!e.target.classList.contains('delete-service-btn')) return;
    if (!confirm('Permanently wipe out this active service profile?')) return;
    
    const currentToken = localStorage.getItem('admin_token');
    const id = e.target.dataset.id;

    const res = await fetch(`/api/services/admin/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (res.ok) loadAdminServices();
});


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

    tbody.innerHTML = bookings.map(b => `
        <tr>
            <td>${escapeHtml(b.date)}</td>
            <td>${escapeHtml(b.time)}</td>
            <td>${escapeHtml(b.guest_name)}</td>
            <td>${escapeHtml(b.email)}</td>
            <td>${escapeHtml(b.phone || '-')}</td>
            <td>${escapeHtml(b.status)}</td>
            <td>
                <button onclick="updateStatus('${escapeHtml(b.id)}', 'confirmed')">Confirm</button>
                <button onclick="updateStatus('${escapeHtml(b.id)}', 'cancelled')">Cancel</button>
            </td>
        </tr>
    `).join('');
}

async function updateStatus(id, status) {
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
    if (reviews.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No reviews yet.</td></tr>';
        return;
    }
    tbody.innerHTML = reviews.map(r => `
        <tr>
            <td>${escapeHtml(r.name)}</td>
            <td>${escapeHtml(String(r.rating))}/5</td>
            <td>${escapeHtml(r.body.length > 80 ? r.body.slice(0, 80) + '…' : r.body)}</td>
            <td>${r.approved ? 'Approved' : 'Pending'}</td>
            <td>
                ${!r.approved ? `<button onclick="approveReview('${escapeHtml(r.id)}')">Approve</button>` : ''}
                <button onclick="deleteReview('${escapeHtml(r.id)}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

async function approveReview(id) {
    const currentToken = localStorage.getItem('admin_token');
    const res = await fetch(`/api/reviews/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (res.ok) loadAdminReviews();
}

async function deleteReview(id) {
    const currentToken = localStorage.getItem('admin_token');
    const res = await fetch(`/api/reviews/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (res.ok) loadAdminReviews();
}

document.getElementById('add-review-form').addEventListener('submit', async (e) => {
    e.preventDefault();
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
        successEl.style.display = 'block';
        errorEl.style.display = 'none';
        setTimeout(() => successEl.style.display = 'none', 3000);
        loadAdminReviews();
    } else {
        const data = await res.json();
        errorEl.textContent = data.error || 'Something went wrong.';
        errorEl.style.display = 'block';
        successEl.style.display = 'none';
    }
});