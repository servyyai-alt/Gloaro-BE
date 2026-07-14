const mongoose = require("mongoose");
require("dotenv").config({ path: "d:/Glora/Gloaro-BE/.env" });
const User = require("../models/User");
const EnterpriseRecord = require("../models/EnterpriseRecord");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to database...");

  // Find any chapter
  const chapter = await EnterpriseRecord.findOne({ module: "organization", type: "chapter" });
  if (!chapter) {
    console.error("No chapter found in database to run explain on.");
    await mongoose.disconnect();
    return;
  }
  const chapterId = chapter._id.toString();
  console.log(`Running explain on chapter ID: ${chapterId}`);

  const explainResult = await User.find({
    role: "customer",
    "meta.adminProfile.organization.chapter": chapterId,
    isActive: true,
    isSuspended: { $ne: true },
    isBlocked: { $ne: true }
  }).explain("executionStats");

  const executionStats = explainResult.executionStats || {};
  const queryPlanner = explainResult.queryPlanner || {};
  const winningPlan = queryPlanner.winningPlan || {};

  console.log("\n==================================================");
  console.log("MONGODB QUERY EXPLAIN VERIFICATION REPORT");
  console.log("==================================================");
  console.log("Winning Plan Stage:", winningPlan.stage);
  
  // Recursively find inputStage to verify index
  let inputStage = winningPlan.inputStage || winningPlan;
  while (inputStage.inputStage) {
    inputStage = inputStage.inputStage;
  }
  console.log("Input Stage Type:", inputStage.stage);
  console.log("Index Name Used:", inputStage.indexName || "None");
  console.log("Total Keys Examined:", executionStats.totalKeysExamined);
  console.log("Total Documents Examined:", executionStats.totalDocsExamined);
  console.log("Execution Time (ms):", executionStats.executionTimeMillis);
  console.log("==================================================\n");

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Explain script failed:", err);
  await mongoose.disconnect();
});
