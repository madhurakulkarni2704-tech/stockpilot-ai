const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    category: { type: String, required: true, trim: true, default: "General" },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    price: { type: Number, required: true, min: 0 },
    cost: { type: Number, min: 0, default: 0 },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    reorderLevel: { type: Number, min: 0, default: 10 },
    supplier: { type: String, trim: true, default: "" },
    unit: { type: String, trim: true, default: "pcs" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

productSchema.virtual("status").get(function () {
  if (this.quantity === 0) return "out_of_stock";
  if (this.quantity <= this.reorderLevel) return "low_stock";
  return "in_stock";
});

// Indexes for the filters and sorts the UI uses most.
productSchema.index({ category: 1 });
productSchema.index({ quantity: 1 });
productSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Product", productSchema);
