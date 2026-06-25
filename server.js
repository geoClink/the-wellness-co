require("dotenv").config();

const express = require("express");
const path = require("path");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const helmet = require("helmet");

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));

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

const supabase = require("./lib/supabase");
const resolveTenant = require("./middleware/resolveTenant");

app.use(require("./routes/webhook"));

app.use(express.json());
app.use(resolveTenant);

app.get("/api/test", (req, res) => res.json({ message: "Server is running!" }));

app.use(require("./routes/services"));
app.use(require("./routes/appointments"));
app.use(require("./routes/contact"));
app.use(require("./routes/settings"));
app.use(require("./routes/auth"));
app.use(require("./routes/gift-cards"));
app.use(require("./routes/coupons"));
app.use(require("./routes/reviews"));

app.use(express.static(path.join(__dirname, "public")));

app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

app.use((err, req, res, next) => {
    res.status(500).sendFile(path.join(__dirname, "public", "500.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running at http://localhost:${PORT}`));