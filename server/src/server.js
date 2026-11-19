const mongoose = require("mongoose");
const config = require("./config");
const app = require("./app");

async function start() {
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 8000 });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("\nCould not connect to MongoDB at", config.mongoUri);
    console.error("Start MongoDB (or set MONGODB_URI to an Atlas connection string) and try again.\n");
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`API running on http://localhost:${config.port}  (AI: ${config.anthropicKey ? "Claude + rules" : "rule-based"})`);
  });

  const shutdown = () => server.close(() => mongoose.disconnect().then(() => process.exit(0)));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start();
