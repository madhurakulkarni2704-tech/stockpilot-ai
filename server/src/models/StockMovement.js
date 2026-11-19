const mongoose = require("mongoose");

// Append-only ledger: every change to a product quantity is recorded here.
const movementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    type: { type: String, enum: ["in", "out", "adjust"], required: true },
    delta: { type: Number, required: true }, // signed change: +10, -3, ...
    balanceAfter: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true, maxlength: 200, default: "" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

movementSchema.index({ product: 1, createdAt: -1 });
movementSchema.index({ type: 1, createdAt: -1 });
movementSchema.index({ createdAt: -1 });

module.exports = mongoose.model("StockMovement", movementSchema);
