const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");

// Planning assumptions (documented in README)
const LEAD_TIME_DAYS = 7; // time a supplier needs to deliver
const COVER_DAYS = 14; // how many days of demand one order should cover
const SAFETY_DAYS = 3; // buffer stock
const HALF = 15; // two 15-day windows = 30 days of history
const DAY = 864e5;

const RISK_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

/**
 * Pure function (easy to unit-test): turns products + recent sales into a forecast.
 * Demand = weighted moving average: last 15 days count 60%, the 15 days before count 40%.
 */
function buildForecast(products, usageById) {
  const items = products.map((p) => {
    const u = usageById.get(String(p._id)) || { recent: 0, previous: 0 };
    const avgDaily = +((u.recent / HALF) * 0.6 + (u.previous / HALF) * 0.4).toFixed(2);
    const daysLeft = avgDaily > 0 ? +(p.quantity / avgDaily).toFixed(1) : null;

    const safety = Math.ceil(avgDaily * SAFETY_DAYS);
    const reorderPoint = Math.ceil(avgDaily * LEAD_TIME_DAYS) + safety;
    const target = Math.max(Math.ceil(avgDaily * (LEAD_TIME_DAYS + COVER_DAYS)) + safety, p.reorderLevel * 2);
    const needsOrder = p.quantity <= Math.max(reorderPoint, p.reorderLevel);
    const suggestedReorder = needsOrder ? Math.max(0, target - p.quantity) : 0;

    let risk = "low";
    if (p.quantity === 0 || (daysLeft !== null && daysLeft <= 3)) risk = "critical";
    else if (daysLeft !== null && daysLeft <= LEAD_TIME_DAYS) risk = "high";
    else if ((daysLeft !== null && daysLeft <= LEAD_TIME_DAYS + COVER_DAYS / 2) || p.quantity <= p.reorderLevel) risk = "medium";

    let trend = "none";
    if (u.previous === 0 && u.recent > 0) trend = "rising";
    else if (u.previous > 0) {
      const ratio = u.recent / u.previous;
      trend = ratio > 1.25 ? "rising" : ratio < 0.75 ? "falling" : "stable";
    }

    let reason;
    if (p.quantity === 0) reason = "Out of stock right now.";
    else if (daysLeft === null) reason = p.quantity <= p.reorderLevel ? "Below reorder level and no recent sales to forecast from." : "No sales in the last 30 days.";
    else if (daysLeft <= LEAD_TIME_DAYS) reason = `At ${avgDaily}/day it runs out in about ${daysLeft} days, before a ${LEAD_TIME_DAYS}-day delivery would arrive.`;
    else if (risk === "medium") reason = `About ${daysLeft} days of stock left; order soon to stay covered.`;
    else reason = `About ${daysLeft} days of stock left. Healthy.`;
    if (trend === "rising" && risk !== "low") reason += " Demand is rising.";

    return {
      productId: String(p._id),
      name: p.name,
      sku: p.sku,
      category: p.category,
      unit: p.unit,
      quantity: p.quantity,
      reorderLevel: p.reorderLevel,
      avgDailyDemand: avgDaily,
      daysLeft,
      trend,
      risk,
      reorderPoint,
      suggestedReorder,
      estimatedCost: +(suggestedReorder * (p.cost || 0)).toFixed(2),
      reason,
    };
  });

  items.sort((a, b) => {
    if (RISK_RANK[a.risk] !== RISK_RANK[b.risk]) return RISK_RANK[a.risk] - RISK_RANK[b.risk];
    const ad = a.daysLeft === null ? Infinity : a.daysLeft;
    const bd = b.daysLeft === null ? Infinity : b.daysLeft;
    return ad - bd;
  });
  return items;
}

function summarize(items) {
  const count = (r) => items.filter((i) => i.risk === r).length;
  const summary = {
    critical: count("critical"),
    high: count("high"),
    medium: count("medium"),
    low: count("low"),
    totalSuggestedUnits: items.reduce((s, i) => s + i.suggestedReorder, 0),
    estimatedReorderCost: +items.reduce((s, i) => s + i.estimatedCost, 0).toFixed(2),
  };
  const urgent = summary.critical + summary.high;
  const headline =
    items.length === 0
      ? "Add products to start getting AI forecasts."
      : urgent > 0
      ? `${urgent} product${urgent > 1 ? "s" : ""} need${urgent > 1 ? "" : "s"} restocking urgently.`
      : summary.medium > 0
      ? `${summary.medium} product${summary.medium > 1 ? "s" : ""} will need restocking soon.`
      : "Stock levels look healthy for the next two weeks.";
  return { summary, headline };
}

async function getForecast() {
  const now = Date.now();
  const d15 = new Date(now - HALF * DAY);
  const d30 = new Date(now - 2 * HALF * DAY);

  const [products, usage] = await Promise.all([
    Product.find().lean(),
    StockMovement.aggregate([
      { $match: { type: "out", createdAt: { $gte: d30 } } },
      {
        $group: {
          _id: "$product",
          recent: { $sum: { $cond: [{ $gte: ["$createdAt", d15] }, { $abs: "$delta" }, 0] } },
          previous: { $sum: { $cond: [{ $gte: ["$createdAt", d15] }, 0, { $abs: "$delta" }] } },
        },
      },
    ]),
  ]);

  const usageById = new Map(usage.map((u) => [String(u._id), u]));
  const items = buildForecast(products, usageById);
  return { ...summarize(items), assumptions: { LEAD_TIME_DAYS, COVER_DAYS, SAFETY_DAYS }, items };
}

module.exports = { buildForecast, summarize, getForecast, LEAD_TIME_DAYS };
