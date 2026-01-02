#!/usr/bin/env node
require("dotenv").config();

const mongoose = require("mongoose");

const uri =
  process.env.MONGODB_URI || process.env.MONGO_URL || process.env.DATABASE_URL;
if (!uri) {
  console.error(
    "Missing DB URL in .env. Set MONGODB_URI (or MONGO_URL/DATABASE_URL)."
  );
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    const db = mongoose.connection.db;
    const coll = db.collection("plans");
    const indexName = "name_1";

    const indexes = await coll.indexes();
    const found = indexes.find((idx) => idx.name === indexName);
    if (!found) {
      console.log(`Index "${indexName}" not found on "plans" collection.`);
      return;
    }

    await coll.dropIndex(indexName);
    console.log(`Dropped index "${indexName}" from "plans" collection.`);
  } catch (err) {
    console.error("Error dropping index:", err);
    process.exitCode = 2;
  } finally {
    await mongoose.disconnect();
  }
})();
