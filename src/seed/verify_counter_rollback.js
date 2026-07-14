const mongoose = require("mongoose");
require("dotenv").config({ path: "d:/Glora/Gloaro-BE/.env" });
const Counter = require("../models/Counter");
const { runInTransaction } = require("../utils/dbHelper");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to database...");

  const moduleKey = "MEMBER:TEST_ROLLBACK";
  await Counter.deleteMany({ module: moduleKey });

  // 1. First transaction (Commit)
  let sequence1;
  await runInTransaction(async (session) => {
    const counter = await Counter.findOneAndUpdate(
      { module: moduleKey },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true, session }
    );
    sequence1 = counter.sequence;
    console.log(`Step 1 (First Transaction): Increment counter -> sequence: ${sequence1}`);
  });

  // 2. Second transaction (Aborted)
  try {
    await runInTransaction(async (session) => {
      const counter = await Counter.findOneAndUpdate(
        { module: moduleKey },
        { $inc: { sequence: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true, session }
      );
      console.log(`Step 2 (Aborting Transaction): Increment counter inside session -> sequence: ${counter.sequence}`);
      throw new Error("Forced Rollback!");
    });
  } catch (err) {
    console.log(`Captured forced rollback error: ${err.message}`);
  }

  // 3. Third transaction (Retry)
  let sequence2;
  await runInTransaction(async (session) => {
    const counter = await Counter.findOneAndUpdate(
      { module: moduleKey },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true, session }
    );
    sequence2 = counter.sequence;
    console.log(`Step 3 (Retry Transaction): Increment counter -> sequence: ${sequence2}`);
  });

  if (sequence2 === sequence1 + 1) {
    console.log("[PASS] Counter successfully rolled back! No gaps introduced.");
  } else {
    console.log(`[FAIL] Counter did not roll back! sequence1: ${sequence1}, sequence2: ${sequence2}`);
  }

  await Counter.deleteMany({ module: moduleKey });
  await mongoose.disconnect();
}

run().catch(console.error);
