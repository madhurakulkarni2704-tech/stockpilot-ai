const express = require("express");
const { z } = require("zod");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const validate = require("../middleware/validate");
const { protect, requireRole } = require("../middleware/auth");
const { HttpError, asyncHandler, escapeRegex } = require("../utils/http");
const { applyStock } = require("../services/inventory");

const router = express.Router();
router.use(protect);

const base = {
  name: z.string().trim().min(1, "Name is required").max(120),
  sku: z.string().trim().min(2, "SKU must be at least 2 characters").max(40),
  category: z.string().trim().min(1).max(60).default("General"),
  description: z.string().trim().max(1000).default(""),
  price: z.coerce.number({ invalid_type_error: "Price must be a number" }).min(0, "Price cannot be negative"),
  cost: z.coerce.number().min(0, "Cost cannot be negative").default(0),
  reorderLevel: z.coerce.number().int("Reorder level must be a whole number").min(0).default(10),
  supplier: z.string().trim().max(100).default(""),
  unit: z.string().trim().max(20).default("pcs"),
};
const createSchema = z.object({ ...base, quantity: z.coerce.number().int("Quantity must be a whole number").min(0).default(0) });
const updateSchema = z.object(base).partial(); // quantity is changed only through stock movements

const listSchema = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  status: z.enum(["in", "low", "out"]).optional(),
  sort: z.enum(["name", "-name", "price", "-price", "quantity", "-quantity", "-createdAt"]).default("-createdAt"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const stockSchema = z
  .object({
    type: z.enum(["in", "out", "adjust"]),
    quantity: z.coerce.number({ invalid_type_error: "Quantity must be a number" }).int("Quantity must be a whole number").min(0),
    note: z.string().trim().max(200).optional(),
  })
  .refine((d) => d.type === "adjust" || d.quantity >= 1, { message: "Quantity must be at least 1", path: ["quantity"] });

router.get(
  "/",
  validate(listSchema, "query"),
  asyncHandler(async (req, res) => {
    const { search, category, status, sort, page, limit } = req.query;
    const filter = {};
    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: rx }, { sku: rx }, { supplier: rx }];
    }
    if (category) filter.category = category;
    if (status === "out") filter.quantity = 0;
    if (status === "low") filter.$expr = { $and: [{ $gt: ["$quantity", 0] }, { $lte: ["$quantity", "$reorderLevel"] }] };
    if (status === "in") filter.$expr = { $gt: ["$quantity", "$reorderLevel"] };

    const [items, total] = await Promise.all([
      Product.find(filter).sort(sort).collation({ locale: "en" }).skip((page - 1) * limit).limit(limit),
      Product.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
  })
);

router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const categories = await Product.distinct("category");
    res.json(categories.sort((a, b) => a.localeCompare(b)));
  })
);

router.post(
  "/",
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const { quantity, ...rest } = req.body;
    const product = await Product.create({ ...rest, quantity, createdBy: req.user._id });
    if (quantity > 0) {
      await StockMovement.create({ product: product._id, type: "in", delta: quantity, balanceAfter: quantity, note: "Opening stock", user: req.user._id });
    }
    res.status(201).json(product);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw new HttpError(404, "Product not found");
    res.json(product);
  })
);

router.put(
  "/:id",
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) throw new HttpError(404, "Product not found");
    res.json(product);
  })
);

router.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) throw new HttpError(404, "Product not found");
    await StockMovement.deleteMany({ product: product._id });
    res.json({ message: "Product deleted" });
  })
);

router.post(
  "/:id/stock",
  validate(stockSchema),
  asyncHandler(async (req, res) => {
    const { product, movement } = await applyStock(req.params.id, req.body, req.user._id);
    res.status(201).json({ product, movement });
  })
);

module.exports = router;
