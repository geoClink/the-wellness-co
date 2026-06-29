require("dotenv").config();

const express = require("express");
const path = require("path");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const helmet = require("helmet");

const app = express();
app.set("trust proxy", 1);

// --- 1. GLOBAL SECURITY HEADERS & CORS ---
app.use(helmet({ contentSecurityPolicy: false, frameguard: false }));
app.use(cors({
    origin: [
        "http://localhost:3000",
        "http://localhost:5500",
        /\.onrender\.com$/,
        /\.vercel\.app$/,
        /\.netlify\.app$/,
    ]
}));

// --- 2. STRIPE WEBHOOK (CRITICAL: Must sit BEFORE express.json) ---
// If your webhook route needs raw request bodies, keep it up here.
app.use("/stripe-webhook", require("./routes/webhook"));
// --- 3. CORE PLUGINS & BODY PARSERS (MUST RUN BEFORE RATE LIMITS & ROUTERS) ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- 4. RATE LIMITERS ---
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Too many requests, please try again later." }
});

const checkoutLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { error: "Too many checkout attempts, please try again later." }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: "Too many login attempts, please try again later." }
});
const PORT = process.env.PORT || 3000;

// Apply limiting proxies
app.use("/api/", generalLimiter);
app.use("/api/checkout", checkoutLimiter);
app.use("/api/login", loginLimiter);

// --- 5. SERVE STATIC ASSETS ---
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/admin.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// --- 6. CORE INITIALIZATIONS ---
const supabase = require("./lib/supabase");
const resolveTenant = require("./middleware/resolveTenant");

// --- 7. API ENDPOINTS ---
app.get("/api/test", (req, res) => res.json({ message: "Server is running!" }));

// Auth & Resource routes passing through resolveTenant securely
app.use("/", resolveTenant, require("./routes/auth")); 
app.use("/", resolveTenant, require("./routes/services"));
app.use("/", resolveTenant, require("./routes/appointments")); // 🌟 Correctly handled here!
app.use("/", resolveTenant, require("./routes/contact"));
app.use("/", resolveTenant, require("./routes/settings"));
app.use("/", resolveTenant, require("./routes/gift-cards"));
app.use("/", resolveTenant, require("./routes/coupons"));
app.use("/", resolveTenant, require("./routes/reviews"));

// --- 8. ERROR FALLBACK HANDLERS ---
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

app.use((err, req, res, next) => {
    console.error("Server Error Hook caught:", err);
    res.status(500).sendFile(path.join(__dirname, "public", "500.html"));
});

// --- 9. LIFECYCLE INITIALIZER ---
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server is running at http://localhost:${PORT}`));
}

module.exports = app;