const express = require("express");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const config = require("../config");
const validate = require("../middleware/validate");
const { protect } = require("../middleware/auth");
const { asyncHandler } = require("../utils/http");
const { getForecast } = require("../services/forecast");
const assistant = require("../services/assistant");
const llm = require("../services/llm");

const router = express.Router();
router.use(protect);

// LLM calls cost money: cap them per IP.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.env === "test" ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many AI requests. Please wait a minute and try again" },
});

router.get(
  "/insights",
  asyncHandler(async (req, res) => {
    res.json(await getForecast());
  })
);

router.get("/status", (req, res) => res.json({ llmEnabled: llm.isEnabled(), model: llm.isEnabled() ? config.anthropicModel : null }));

router.post(
  "/assistant",
  aiLimiter,
  validate(z.object({ question: z.string().trim().min(2, "Ask a question").max(500, "Keep the question under 500 characters") })),
  asyncHandler(async (req, res) => {
    res.json(await assistant.answer(req.body.question));
  })
);

router.post(
  "/describe",
  aiLimiter,
  validate(z.object({ name: z.string().trim().min(2, "Enter a product name first").max(120), category: z.string().trim().max(60).optional() })),
  asyncHandler(async (req, res) => {
    res.json(await assistant.describeProduct(req.body.name, req.body.category));
  })
);

module.exports = router;
