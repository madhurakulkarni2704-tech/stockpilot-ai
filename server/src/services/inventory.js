const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const { HttpError } = require("../utils/http");

/**
 * Apply a stock change and record it in the ledger.
 * - "in":     atomically increments quantity
 * - "out":    atomically decrements ONLY if enough stock exists (no negative stock, no race)
 * - "adjust": sets quantity to an absolute counted value (stock-take)
 */
async function applyStock(productId, { type, quantity, note }, userId) {
  let product;
  let delta;

  if (type === "in") {
    product = await Product.findByIdAndUpdate(productId, { $inc: { quantity } }, { new: true });
    delta = quantity;
  } else if (type === "out") {
    product = await Product.findOneAndUpdate(
      { _id: productId, quantity: { $gte: quantity } },
      { $inc: { quantity: -quantity } },
      { new: true }
    );
    if (!product) {
      const exists = await Product.exists({ _id: productId });
      if (!exists) throw new HttpError(404, "Product not found");
      throw new HttpError(400, "Not enough stock to remove that quantity");
    }
    delta = -quantity;
  } else {
    const before = await Product.findById(productId);
    if (!before) throw new HttpError(404, "Product not found");
    if (before.quantity === quantity) {
      throw new HttpError(400, "The counted quantity matches the current stock");
    }
    delta = quantity - before.quantity;
    product = await Product.findByIdAndUpdate(productId, { $set: { quantity } }, { new: true });
  }

  if (!product) throw new HttpError(404, "Product not found");

  const movement = await StockMovement.create({
    product: product._id,
    type,
    delta,
    balanceAfter: product.quantity,
    note: note || "",
    user: userId,
  });

  return { product, movement };
}

module.exports = { applyStock };
