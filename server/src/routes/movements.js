const express = require("express");
const { z } = require("zod");
const StockMovement = require("../models/StockMovement");
const validate = require("../middleware/validate");
const { protect } = require("../middleware/auth");
const { asyncHandler } = require("../utils/http");

const router = express.Router();
router.use(protect);

const listSchema = z.object({
  product: z.string().trim().optional(),
  type: z.enum(["in", "out", "adjust"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(15),
});

router.get(
  "/",
  validate(listSchema, "query"),
  asyncHandler(async (req, res) => {
    const { product, type, page, limit } = req.query;
    const filter = {};
    if (product) filter.product = product;
    if (type) filter.type = type;
    const [items, total] = await Promise.all([
      StockMovement.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("product", "name sku unit")
        .populate("user", "name"),
      StockMovement.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
  })
);

module.exports = router;
