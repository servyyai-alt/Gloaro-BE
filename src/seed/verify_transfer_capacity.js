const mongoose = require("mongoose");
require("dotenv").config({ path: "d:/Glora/Gloaro-BE/.env" });
const User = require("../models/User");
const EnterpriseRecord = require("../models/EnterpriseRecord");

const BASE_URL = "http://localhost:5000/api/v1";

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: status ${res.status}`);
  }
  const json = await res.json();
  return {
    accessToken: json.data.accessToken,
    refreshToken: json.data.refreshToken,
    user: json.data.user
  };
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to database...");

  // 1. Get or create Region, State, District, and Chapters
  let region = await EnterpriseRecord.findOne({ module: "organization", type: "region", name: "Transfer Test Region" });
  if (!region) {
    region = new EnterpriseRecord({ module: "organization", type: "region", name: "Transfer Test Region", code: "TTR", status: "active" });
    await region.save();
  }
  let state = await EnterpriseRecord.findOne({ module: "organization", type: "state", name: "Transfer Test State" });
  if (!state) {
    state = new EnterpriseRecord({ module: "organization", type: "state", name: "Transfer Test State", code: "TTS", parent: region._id, status: "active" });
    await state.save();
  }
  let district = await EnterpriseRecord.findOne({ module: "organization", type: "district", name: "Transfer Test District" });
  if (!district) {
    district = new EnterpriseRecord({ module: "organization", type: "district", name: "Transfer Test District", code: "TTD", parent: state._id, status: "active" });
    await district.save();
  }
  let chapterA = await EnterpriseRecord.findOne({ module: "organization", type: "chapter", name: "Transfer Chapter A" });
  if (!chapterA) {
    chapterA = new EnterpriseRecord({ module: "organization", type: "chapter", name: "Transfer Chapter A", code: "TCA", parent: district._id, status: "active" });
    await chapterA.save();
  }
  let chapterB = await EnterpriseRecord.findOne({ module: "organization", type: "chapter", name: "Transfer Chapter B" });
  if (!chapterB) {
    chapterB = new EnterpriseRecord({ module: "organization", type: "chapter", name: "Transfer Chapter B", code: "TCB", parent: district._id, status: "active" });
    await chapterB.save();
  }

  // 2. Clean previous E2E test data
  const testEmailPrefix = "e2e_transfer_";
  await User.deleteMany({ email: new RegExp("^" + testEmailPrefix) });
  console.log("Database cleaned.");

  // 3. Hydrate Chapter A with exactly 70 mock active members
  console.log("Hydrating Chapter A with 70 active members. Please wait...");
  const mockUsers = [];
  for (let i = 1; i <= 70; i++) {
    const user = new User({
      name: `E2E Transfer Member ${i}`,
      email: `${testEmailPrefix}member_${i}@gloaro.com`,
      phone: `91100000${String(i).padStart(2, "0")}`,
      password: "Password@123",
      role: "customer",
      isActive: true,
      isEmailVerified: true
    });
    user.meta = new Map([
      ["adminProfile", {
        organization: {
          region: region._id.toString(),
          state: state._id.toString(),
          district: district._id.toString(),
          chapter: chapterA._id.toString()
        }
      }]
    ]);
    mockUsers.push(user);
  }
  await User.insertMany(mockUsers);
  console.log("[PASS] Chapter A hydrated with 70 members.");

  // 4. Create 1 member in Chapter B (to be transferred to Chapter A)
  const transferUser = new User({
    name: "E2E Member to Transfer",
    email: `${testEmailPrefix}transfer_candidate@gloaro.com`,
    phone: "9110000099",
    password: "Password@123",
    role: "customer",
    isActive: true,
    isEmailVerified: true
  });
  transferUser.meta = new Map([
    ["adminProfile", {
      organization: {
        region: region._id.toString(),
        state: state._id.toString(),
        district: district._id.toString(),
        chapter: chapterB._id.toString()
      }
    }]
  ]);
  await transferUser.save();
  console.log(`Created transfer candidate user in Chapter B: ${transferUser.email} (ID: ${transferUser._id})`);

  console.log("\n==================================================");
  console.log("E2E MEMBER TRANSFER CAPACITY AUDIT");
  console.log("==================================================\n");

  // Step 5: Log in as Super Admin
  console.log("Step 1: Logging in as Super Admin...");
  const adminAuth = await login("superadmin@vendordirectory.com", "SuperAdmin@123");
  console.log("[PASS] Super Admin logged in.");

  // Step 6: Attempt to transfer candidate from Chapter B -> Chapter A
  console.log("Step 2: Attempting to transfer candidate user to Chapter A (expecting rejection)...");
  const transferPayload = {
    organization: {
      region: region._id.toString(),
      state: state._id.toString(),
      district: district._id.toString(),
      chapter: chapterA._id.toString()
    }
  };

  const transferRes = await fetch(`${BASE_URL}/admin/admin-accounts/${transferUser._id}/transfer`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminAuth.accessToken}`
    },
    body: JSON.stringify(transferPayload)
  });

  console.log(`Transfer response status: ${transferRes.status}`);
  const transferJson = await transferRes.json();
  console.log("Transfer response body:", JSON.stringify(transferJson, null, 2));

  // Step 7: Assertions
  if (transferRes.status !== 409) {
    throw new Error(`[FAIL] Expected 409 status code, but got ${transferRes.status}`);
  }
  if (transferJson.success !== false || !transferJson.message.includes("Maximum member limit reached")) {
    throw new Error(`[FAIL] Unexpected response message: ${transferJson.message}`);
  }
  console.log("[PASS] API successfully blocked the transfer with 409 status code and clean error message.");

  // Step 8: Verify user's chapter remains Chapter B in DB
  console.log("Step 3: Checking database state of transfer candidate...");
  const dbUser = await User.findById(transferUser._id).lean();
  const dbUserChapter = dbUser.meta?.adminProfile?.organization?.chapter;
  console.log(` - User's Chapter in DB: ${dbUserChapter}`);
  if (dbUserChapter.toString() !== chapterB._id.toString()) {
    throw new Error(`[FAIL] User's chapter was updated to ${dbUserChapter}!`);
  }
  console.log("[PASS] Database state verified: transfer candidate remained in Chapter B.");

  // Clean up E2E test data
  await User.deleteMany({ email: new RegExp("^" + testEmailPrefix) });
  console.log("\nCleanup completed.");

  await mongoose.disconnect();
  console.log("\n==================================================");
  console.log("E2E MEMBER TRANSFER CAPACITY AUDIT SUCCESSFUL");
  console.log("==================================================\n");
}

run().catch(async (err) => {
  console.error("Test failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
