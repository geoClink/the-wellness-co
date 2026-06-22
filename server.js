require("dotenv").config();

const express = require("express");
const path = require("path");
const rateLimit = require("express-rate-limit");
const cors = require("cors");

const app = express();
app.set("trust proxy", 1);

app.use(cors({
    origin: [
        "http://localhost:3000",
        "http://localhost:5500",
        /\.onrender\.com$/,
        /\.vercel\.app$/,
        /\.netlify\.app$/,
    ]
}));

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Too many requests, please try again later." },
    skip: (req) => !!req.headers.authorization?.startsWith("Bearer ")
});

const checkoutLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { error: "Too many checkout attempts, please try again later." }
});

app.use("/api/", generalLimiter);
app.use("/api/checkout", checkoutLimiter);

const supabase = require("./lib/supabase");
const resolveTenant = require("./middleware/resolveTenant");

app.use(require("./routes/webhook"));

app.use(express.json());
app.use(resolveTenant);

app.get("/api/test", (req, res) => res.json({ message: "Server is running!" }));
app.get("/api/config", (req, res) => res.json ({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    vertical: req.tenant?.vertical || "wellness"
}));

app.use(require("./routes/services"));
app.use(require("./routes/appointments"));
app.use(require("./routes/contact"));
app.use(require("./routes/settings"));
app.use(require("./routes/auth"));
app.use(require("./routes/gift-cards"));
app.use(require("./routes/coupons"));
app.use(require("./routes/reviews"));

app.use(express.static(path.join(__dirname, "public")));

const PORT = 3000;
app.listen(PORT, () => console.log(`Server is running at http://localhost:${PORT}`));