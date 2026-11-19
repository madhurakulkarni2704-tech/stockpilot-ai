const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const config = require("./config");
const { notFound, errorHandler } = require("./middleware/error");

const app = express();

app.use(helmet());
app.use(cors({ origin: config.clientOrigin.split(",").map((s) => s.trim()) }));
app.use(express.json({ limit: "100kb" }));
if (config.env !== "test") app.use(morgan("dev"));

app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.env === "production" ? 50 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later" },
});

app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/movements", require("./routes/movements"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/ai", require("./routes/ai"));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
