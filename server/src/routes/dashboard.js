const express = require("express");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const { protect } = require("../middleware/auth");
const { asyncHandler } = require("../utils/http");

const router = express.Router();
router.use(protect);

const isLow = { $and: [{ $gt: ["$quantity", 0] }, { $lte: ["$quantity", "$reorderLevel"] }] };

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 13);

    const [totalsArr, byCategory, trendRows, recent, attention] = await Promise.all([
      Product.aggregate([
        {
          $group: {
            _id: null,
            products: { $sum: 1 },
            units: { $sum: "$quantity" },
            value: { $sum: { $multiply: ["$quantity", "$price"] } },
            cost: { $sum: { $multiply: ["$quantity", "$cost"] } },
            lowStock: { $sum: { $cond: [isLow, 1, 0] } },
            outOfStock: { $sum: { $cond: [{ $eq: ["$quantity", 0] }, 1, 0] } },
          },
        },
      ]),
      Product.aggregate([
        { $group: { _id: "$category", products: { $sum: 1 }, units: { $sum: "$quantity" }, value: { $sum: { $multiply: ["$quantity", "$price"] } } } },
        { $sort: { value: -1 } },
      ]),
      StockMovement.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            inbound: { $sum: { $cond: [{ $eq: ["$type", "in"] }, "$delta", 0] } },
            outbound: { $sum: { $cond: [{ $eq: ["$type", "out"] }, { $abs: "$delta" }, 0] } },
          },
        },
      ]),
      StockMovement.find().sort({ createdAt: -1 }).limit(8).populate("product", "name sku").populate("user", "name"),
      Product.find({ $expr: { $lte: ["$quantity", "$reorderLevel"] } }).sort({ quantity: 1 }).limit(6),
    ]);

    const totals = totalsArr[0] || { products: 0, units: 0, value: 0, cost: 0, lowStock: 0, outOfStock: 0 };
    delete totals._id;

    const byDay = new Map(trendRows.map((r) => [r._id, r]));
    const trend = [];
    for (let i = 13; i >= 0; i--) {
      const key = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      const r = byDay.get(key) || {};
      trend.push({ date: key, inbound: r.inbound || 0, outbound: r.outbound || 0 });
    }

    res.json({
      totals,
      byCategory: byCategory.map((c) => ({ category: c._id, products: c.products, units: c.units, value: c.value })),
      trend,
      recent,
      attention,
    });
  })
);

module.exports = router;
