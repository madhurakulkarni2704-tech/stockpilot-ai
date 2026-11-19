/* Seeds demo users, ~24 products and 30 days of realistic stock history.
   WARNING: resets products and stock movements (users are kept). */
const mongoose = require("mongoose");
const config = require("./config");
const User = require("./models/User");
const Product = require("./models/Product");
const StockMovement = require("./models/StockMovement");

// name, sku, category, price, cost, reorderLevel, supplier, unitsPerDay, mode
// mode: "normal" restocks when low | "drain" never restocks (ends low) | "out" ends at zero
// growth: demand multiplier for the most recent 15 days (shows rising / falling trends)
const CATALOG = [
  ["Wireless Mouse", "ELEC-1001", "Electronics", 799, 520, 20, "TechSource India", 4, "normal", 1.3],
  ["Mechanical Keyboard", "ELEC-1002", "Electronics", 3499, 2400, 10, "TechSource India", 1.5, "drain", 1.5],
  ["USB-C Charger 65W", "ELEC-1003", "Electronics", 1899, 1250, 15, "VoltEdge", 3, "normal", 1],
  ["27-inch Monitor", "ELEC-1004", "Electronics", 14999, 11800, 5, "Pixel Wholesale", 0.5, "normal", 1],
  ["Noise-Cancelling Headphones", "ELEC-1005", "Electronics", 6999, 4900, 8, "Pixel Wholesale", 1, "out", 1.2],
  ["HD Webcam", "ELEC-1006", "Electronics", 2499, 1600, 10, "TechSource India", 1.2, "normal", 0.7],
  ["USB Hub 7-Port", "ELEC-1007", "Electronics", 1199, 700, 12, "VoltEdge", 1.5, "normal", 1],
  ["A4 Notebook (Pack of 5)", "STAT-2001", "Stationery", 349, 190, 40, "PaperTrail Co.", 8, "normal", 1.1],
  ["Gel Pen Box (50 pcs)", "STAT-2002", "Stationery", 449, 260, 30, "PaperTrail Co.", 5, "drain", 1.4],
  ["Sticky Notes (12 pads)", "STAT-2003", "Stationery", 199, 90, 50, "PaperTrail Co.", 6, "normal", 1],
  ["Desk Organizer", "STAT-2004", "Stationery", 599, 340, 15, "PaperTrail Co.", 1.5, "normal", 1],
  ["Whiteboard Markers (Set of 8)", "STAT-2005", "Stationery", 279, 150, 25, "PaperTrail Co.", 3, "normal", 0.6],
  ["Ergonomic Office Chair", "FURN-3001", "Furniture", 9499, 6600, 4, "UrbanNest", 0.4, "drain", 1.6],
  ["Standing Desk", "FURN-3002", "Furniture", 18999, 14200, 3, "UrbanNest", 0.25, "normal", 1],
  ["LED Desk Lamp", "FURN-3003", "Furniture", 1299, 760, 12, "UrbanNest", 1.2, "normal", 1],
  ["Bookshelf 5-Tier", "FURN-3004", "Furniture", 4299, 2900, 4, "UrbanNest", 0.3, "normal", 1],
  ["Steel Water Bottle 1L", "KITC-4001", "Kitchen", 649, 330, 30, "HomeCraft", 4, "normal", 1.2],
  ["Insulated Lunch Box", "KITC-4002", "Kitchen", 899, 480, 20, "HomeCraft", 2.5, "drain", 1.3],
  ["Ceramic Coffee Mug", "KITC-4003", "Kitchen", 299, 140, 40, "HomeCraft", 5, "normal", 1],
  ["Electric Kettle 1.5L", "KITC-4004", "Kitchen", 1499, 920, 10, "HomeCraft", 1.5, "out", 1],
  ["Laptop Backpack", "ACCS-5001", "Accessories", 1799, 980, 15, "CarryAll", 2.5, "normal", 1],
  ["Leather Wallet", "ACCS-5002", "Accessories", 999, 520, 15, "CarryAll", 2, "normal", 0.8],
  ["Laptop Sleeve 15-inch", "ACCS-5003", "Accessories", 899, 450, 15, "CarryAll", 2, "normal", 1],
  ["Phone Stand", "ACCS-5004", "Accessories", 399, 180, 25, "CarryAll", 3.5, "normal", 1],
];

const rand = (a, b) => a + Math.random() * (b - a);
const DAYS = 30;

// Pure & exported for testing: simulate 30 days of stock history for one catalog row.
function generateHistory(row, now = Date.now()) {
  const [, , , , , reorderLevel, , perDay, mode, growth] = row;
  const expectedSold = perDay * (15 + 15 * growth);
  // drain: ends slightly below the reorder level (low stock) | out: runs dry mid-way | normal: comfortable
  let qty = mode === "out" ? Math.round(expectedSold * 0.8) : mode === "drain" ? Math.round(expectedSold + reorderLevel * 0.5) : Math.round(perDay * 30 + reorderLevel * 2);
  const at = (daysAgo) => new Date(now - daysAgo * 864e5 - rand(1, 10) * 36e5);
  const moves = [{ type: "in", delta: qty, balanceAfter: qty, note: "Opening stock", createdAt: at(DAYS) }];

  for (let d = DAYS - 1; d >= 0; d--) {
    const factor = d < 15 ? growth : 1;
    let sold = Math.max(0, Math.round(perDay * factor * rand(0.5, 1.5)));
    sold = Math.min(sold, qty);
    if (sold > 0) {
      qty -= sold;
      moves.push({ type: "out", delta: -sold, balanceAfter: qty, note: "Customer order", createdAt: at(d) });
    }
    if (mode === "normal" && qty <= reorderLevel && Math.random() < 0.5) {
      const add = Math.max(10, Math.round(perDay * 21));
      qty += add;
      moves.push({ type: "in", delta: add, balanceAfter: qty, note: "Supplier delivery", createdAt: at(d) });
    }
  }
  moves.sort((a, b) => a.createdAt - b.createdAt);
  // Re-derive balances after sorting so the ledger is internally consistent.
  let running = 0;
  for (const m of moves) {
    running += m.delta;
    m.balanceAfter = running;
  }
  return { finalQty: running, moves };
}

async function run() {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 8000 });

  const demoUsers = [
    { name: "Demo Admin", email: "admin@demo.com", password: "Admin@123", role: "admin" },
    { name: "Demo Staff", email: "staff@demo.com", password: "Staff@123", role: "staff" },
  ];
  let admin;
  for (const u of demoUsers) {
    let doc = await User.findOne({ email: u.email });
    if (!doc) doc = await User.create(u);
    if (u.role === "admin") admin = doc;
  }

  await Promise.all([Product.deleteMany({}), StockMovement.deleteMany({})]);

  let movementCount = 0;
  for (const row of CATALOG) {
    const [name, sku, category, price, cost, reorderLevel, supplier] = row;
    const { finalQty, moves } = generateHistory(row);
    const product = await Product.create({
      name, sku, category, price, cost, reorderLevel, supplier,
      quantity: finalQty,
      description: `${name} from ${supplier}.`,
      createdBy: admin._id,
    });
    // Raw insert so backdated createdAt values are kept exactly as generated.
    await StockMovement.collection.insertMany(
      moves.map((m) => ({ ...m, product: product._id, user: admin._id, updatedAt: m.createdAt }))
    );
    movementCount += moves.length;
  }

  console.log(`Seeded ${CATALOG.length} products and ${movementCount} stock movements.`);
  console.log("Demo logins:  admin@demo.com / Admin@123   |   staff@demo.com / Staff@123");
  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch((err) => {
    console.error("Seeding failed:", err.message);
    process.exit(1);
  });
}

module.exports = { generateHistory, CATALOG };
