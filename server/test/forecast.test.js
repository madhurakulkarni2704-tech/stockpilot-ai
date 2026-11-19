const test = require("node:test");
const assert = require("node:assert");
const { buildForecast, summarize } = require("../src/services/forecast");
const { generateHistory, CATALOG } = require("../src/seed");

const P = (id, quantity, reorderLevel = 10, cost = 100) => ({ _id: id, name: id, sku: id.toUpperCase(), category: "X", unit: "pcs", quantity, reorderLevel, cost });

test("out of stock is critical and gets a reorder suggestion", () => {
  const [item] = buildForecast([P("a", 0)], new Map([["a", { recent: 30, previous: 30 }]]));
  assert.strictEqual(item.risk, "critical");
  assert.ok(item.suggestedReorder > 0);
});

test("weighted moving average and days-left are computed correctly", () => {
  // recent 30 units/15d = 2/day (60%), previous 15/15d = 1/day (40%) -> 1.6/day
  const [item] = buildForecast([P("a", 16)], new Map([["a", { recent: 30, previous: 15 }]]));
  assert.strictEqual(item.avgDailyDemand, 1.6);
  assert.strictEqual(item.daysLeft, 10);
  assert.strictEqual(item.trend, "rising");
});

test("risk is high when stock runs out before a delivery would arrive", () => {
  const [item] = buildForecast([P("a", 20)], new Map([["a", { recent: 60, previous: 60 }]])); // 4/day -> 5 days
  assert.strictEqual(item.risk, "high");
});

test("healthy stock needs no reorder", () => {
  const [item] = buildForecast([P("a", 500)], new Map([["a", { recent: 15, previous: 15 }]]));
  assert.strictEqual(item.risk, "low");
  assert.strictEqual(item.suggestedReorder, 0);
});

test("items are sorted most urgent first and summary counts match", () => {
  const items = buildForecast([P("ok", 900), P("bad", 0)], new Map());
  assert.strictEqual(items[0].sku, "BAD");
  const { summary } = summarize(items);
  assert.strictEqual(summary.critical, 1);
});

test("seed history is internally consistent and never negative", () => {
  for (const row of CATALOG) {
    const { finalQty, moves } = generateHistory(row);
    assert.ok(finalQty >= 0, `${row[1]} ended negative`);
    assert.ok(moves.every((m) => m.balanceAfter >= 0));
    assert.strictEqual(moves[moves.length - 1].balanceAfter, finalQty);
  }
});
