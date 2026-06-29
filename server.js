require("dotenv").config();

const express = require("express");
const path = require("path");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const helmet = require("helmet");

const app = express();
app.set("trust proxy", 1);
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

// --- RATE LIMITERS ---
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

app.use("/api/", generalLimiter);
app.use("/api/checkout", checkoutLimiter);
app.use("/api/login", loginLimiter);

// --- CORE INITIALIZATIONS ---
const supabase = require("./lib/supabase");
const resolveTenant = require("./middleware/resolveTenant");

app.use(require("./routes/webhook"));
app.use(express.json());

// 1. SERVE STATIC FILES & DIRECT HTML VIEWS
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/admin.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// 2. 🔓 OPEN API ENDPOINTS (Bypasses Tenant Restrictions)
app.get("/api/test", (req, res) => res.json({ message: "Server is running!" }));
app.use("/", require("./routes/auth")); 

// 3. 🔒 SECURED API DATA ENDPOINTS
// Routed through "/" because your route files already include the "/api" prefix internally
app.use("/", resolveTenant, require("./routes/services"));
app.use("/", resolveTenant, require("./routes/appointments"));
app.use("/", resolveTenant, require("./routes/contact"));
app.use("/", resolveTenant, require("./routes/settings"));
app.use("/", resolveTenant, require("./routes/gift-cards"));
app.use("/", resolveTenant, require("./routes/coupons"));
app.use("/", resolveTenant, require("./routes/reviews"));

// --- ERROR FALLBACK HANDLERS ---
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

app.use((err, req, res, next) => {
    console.error("Server Error Hook caught:", err);
    res.status(500).sendFile(path.join(__dirname, "public", "500.html"));
});

// --- LIFECYCLE INITIALIZER ---
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server is running at http://localhost:${PORT}`));
}

module.exports = app;