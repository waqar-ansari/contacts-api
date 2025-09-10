// controllers/saveBulkUserFortesting.js
// const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/userModel");


/**
 * Bulk user insert for testing.
 * - auto-verify users
 * - ensures unique serialNumber for every user
 * - normalizes phone strings => phonenumbers array
 * - ensures unique emails (adjusts only when collision with existing DB/batch)
 */
const bulkUser = async (req, res) => {
  try {
    let { users } = req.body;
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ status: "error", message: "No users provided" });
    }

    // Hash a default password once (faster than hashing per user if default)
    const DEFAULT_PASSWORD = "Test@1234";
    // const defaultHashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // Collect emails from input (normalize)
    const inputEmails = users
      .map((u) => (u.email ? String(u.email).trim().toLowerCase() : null))
      .filter(Boolean);

    // Find existing emails in DB to avoid duplicate key errors
    const existing = inputEmails.length > 0
      ? await User.find({ email: { $in: inputEmails } }).select("email").lean()
      : [];
    const existingEmailSet = new Set(existing.map(e => e.email));

    // Track used emails in this batch (to avoid duplicates among themselves)
    const usedEmails = new Set();

    // Prepare docs to insert (converted to DB shape)
    const prepared = users.map((u, idx) => {
      // 1) email: normalize or generate test email if none
      let email = u.email ? String(u.email).trim().toLowerCase() : null;
      if (!email) {
        email = `test_${Date.now()}_${idx}@example.com`;
      }

      // If email already exists in DB or already used in this batch, make a unique fallback
      if (existingEmailSet.has(email) || usedEmails.has(email)) {
        // append suffix to guarantee uniqueness
        email = `${email.split("@")[0]}+${Date.now()}_${idx}@${email.split("@")[1] || "example.com"}`;
      }
      usedEmails.add(email);

      // 2) serialNumber: create a unique string to satisfy your unique index
      const serialNumber = new mongoose.Types.ObjectId().toHexString();

      // 3) phone normalization: your input may be "367-102-0455" or array/object
      let phonenumbers = [];
      if (u.phonenumbers) {
        if (Array.isArray(u.phonenumbers)) {
          // map strings or objects to expected object shape
          phonenumbers = u.phonenumbers.map((p) => {
            if (typeof p === "string") {
              const cleaned = String(p).replace(/[^\d]/g, "");
              return { countryCode: "", number: cleaned };
            }
            if (typeof p === "object") {
              return {
                countryCode: p.countryCode ? String(p.countryCode) : "",
                number: p.number ? String(p.number).replace(/[^\d]/g, "") : "",
              };
            }
            return null;
          }).filter(Boolean);
        } else if (typeof u.phonenumbers === "string") {
          const cleaned = String(u.phonenumbers).replace(/[^\d]/g, "");
          phonenumbers = [{ countryCode: "", number: cleaned }];
        } else if (typeof u.phonenumbers === "object" && u.phonenumbers.number) {
          phonenumbers = [{
            countryCode: u.phonenumbers.countryCode ? String(u.phonenumbers.countryCode) : "",
            number: String(u.phonenumbers.number).replace(/[^\d]/g, ""),
          }];
        }
      }

      // 4) password: if provided, hash it; otherwise use default hashed value
      const passwordProvided = u.password ? String(u.password) : null;
      const password = DEFAULT_PASSWORD

      // 5) Build doc
      return {
        firstname: u.firstname || `TestUser${idx}`,
        lastname: u.lastname || `Lastname${idx}`,
        company: u.company || "",
        designation: u.designation || "",
        email,
        password,
        isVerified: true,
        signupMethod: "email",
        provider: "local",
        role: "user",
        isActive: true,
        serialNumber,
        phonenumbers,
        // add any additional minimal required fields your model mandates
      };
    });

    // Insert in batches to avoid memory/DB spike
    const BATCH_SIZE = 10000; // reduce for smaller servers; increase for bigger machines
    let totalInserted = 0;
    const errors = [];

    for (let i = 0; i < prepared.length; i += BATCH_SIZE) {
      const batch = prepared.slice(i, i + BATCH_SIZE);

      try {
        // Use native collection API — it returns insertedCount even on partial failures
        const result = await User.collection.insertMany(batch, { ordered: false });
        const insertedCount = result && result.insertedCount ? result.insertedCount : 0;
        totalInserted += insertedCount;
        console.log(`Inserted batch ${i / BATCH_SIZE + 1}: ${insertedCount}`);
      } catch (err) {
        // Bulk write error — try to extract how many were inserted
        console.error("Batch insert error:", err && err.message ? err.message : err);

        // For older drivers / different formats, try these fallbacks:
        if (err && err.result && typeof err.result.nInserted === "number") {
          totalInserted += err.result.nInserted;
        } else if (err && typeof err.insertedCount === "number") {
          totalInserted += err.insertedCount;
        } else if (err && Array.isArray(err.writeErrors)) {
          // estimate inserted = batch.length - number of writeErrors
          totalInserted += Math.max(0, batch.length - err.writeErrors.length);
        }
        // push error to list for debugging
        errors.push({
          batch: i / BATCH_SIZE + 1,
          message: err && err.message ? err.message : String(err),
          writeErrors: err && err.writeErrors ? err.writeErrors.slice(0, 5) : undefined // sample
        });
      }
    }

    return res.status(200).json({
      status: "success",
      message: `Bulk users added. Inserted ${totalInserted}`,
      count: totalInserted,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    console.error("Bulk User Save Error (fatal):", err);
    return res.status(500).json({ status: "error", message: err.message || String(err) });
  }
};

module.exports = { bulkUser };






