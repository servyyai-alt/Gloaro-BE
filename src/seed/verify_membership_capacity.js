const mongoose = require("mongoose");
require("dotenv").config({ path: "d:/Glora/Gloaro-BE/.env" });
const User = require("../models/User");
const MembershipApplication = require("../models/MembershipApplication");
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

  // 1. Get or create a test Region, State, District, and Chapter
  let region = await EnterpriseRecord.findOne({ module: "organization", type: "region", name: "Capacity Test Region" });
  if (!region) {
    region = new EnterpriseRecord({ module: "organization", type: "region", name: "Capacity Test Region", code: "CTR", status: "active" });
    await region.save();
  }
  let state = await EnterpriseRecord.findOne({ module: "organization", type: "state", name: "Capacity Test State" });
  if (!state) {
    state = new EnterpriseRecord({ module: "organization", type: "state", name: "Capacity Test State", code: "CTS", parent: region._id, status: "active" });
    await state.save();
  }
  let district = await EnterpriseRecord.findOne({ module: "organization", type: "district", name: "Capacity Test District" });
  if (!district) {
    district = new EnterpriseRecord({ module: "organization", type: "district", name: "Capacity Test District", code: "CTD", parent: state._id, status: "active" });
    await district.save();
  }
  let chapter = await EnterpriseRecord.findOne({ module: "organization", type: "chapter", name: "Capacity Test Chapter" });
  if (!chapter) {
    chapter = new EnterpriseRecord({ module: "organization", type: "chapter", name: "Capacity Test Chapter", code: "CTC", parent: district._id, status: "active" });
    await chapter.save();
  }

  console.log(`Using Chapter: ${chapter.name} (ID: ${chapter._id})`);

  // 2. Clean previous E2E test data
  const testEmailPrefix = "e2e_capacity_";
  await User.deleteMany({ email: new RegExp("^" + testEmailPrefix) });
  await MembershipApplication.deleteMany({ applicationNumber: new RegExp("^E2E_CAP_") });
  console.log("Database cleaned.");

  // 3. Hydrate Chapter with exactly 70 mock active members
  console.log("Hydrating chapter with 70 active members. Please wait...");
  const mockUsers = [];
  for (let i = 1; i <= 70; i++) {
    const user = new User({
      name: `E2E Capacity Member ${i}`,
      email: `${testEmailPrefix}member_${i}@gloaro.com`,
      phone: `90000000${String(i).padStart(2, "0")}`,
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
          chapter: chapter._id.toString()
        }
      }]
    ]);
    mockUsers.push(user);
  }
  await User.insertMany(mockUsers);
  console.log("[PASS] Chapter hydrated with 70 members.");

  // 4. Verify initial active member count
  const initialCount = await User.countDocuments({
    role: "customer",
    "meta.adminProfile.organization.chapter": chapter._id.toString(),
    isActive: true,
    isSuspended: { $ne: true },
    isBlocked: { $ne: true }
  });
  console.log(`Initial active member count: ${initialCount}`);
  if (initialCount !== 70) {
    throw new Error(`Expected exactly 70 members, but found ${initialCount}`);
  }

  // 5. Create 71st customer (the pending applicant)
  const user71 = new User({
    name: "E2E Capacity Member 71",
    email: `${testEmailPrefix}member_71@gloaro.com`,
    phone: "9000000071",
    password: "Password@123",
    role: "customer",
    isActive: false,
    isEmailVerified: false
  });
  await user71.save();

  // Create pending MembershipApplication
  const app71 = new MembershipApplication({
    applicationNumber: "E2E_CAP_71",
    submittedBy: user71._id,
    status: "submitted",
    regionId: region._id,
    stateId: state._id,
    districtId: district._id,
    chapterId: chapter._id,
    personal: {
      fullName: "E2E Capacity Member 71",
      emailAddress: `${testEmailPrefix}member_71@gloaro.com`,
      mobileNumber: "9000000071"
    }
  });
  await app71.save();
  console.log(`Pending application created for 71st applicant: ${app71.applicationNumber} (ID: ${app71._id})`);

  console.log("\n==================================================");
  console.log("E2E MEMBERSHIP CAPACITY LIMIT AUDIT");
  console.log("==================================================\n");

  // Step 6: Log in as Super Admin
  console.log("Step 1: Logging in as Super Admin...");
  const adminAuth = await login("superadmin@vendordirectory.com", "Password@123");
  console.log("[PASS] Super Admin logged in.");

  // Step 7: Attempt to approve the 71st member
  console.log("Step 2: Attempting to approve 71st member application (expecting rejection)...");
  const approveRes = await fetch(`${BASE_URL}/membership-applications/${app71._id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminAuth.accessToken}`
    },
    body: JSON.stringify({
      status: "approved",
      adminNotes: "Try to approve past capacity limit"
    })
  });

  console.log(`Approval response status: ${approveRes.status}`);
  const approveJson = await approveRes.json();
  console.log("Approval response body:", JSON.stringify(approveJson, null, 2));

  // Step 8: Assertions
  if (approveRes.status !== 409) {
    throw new Error(`[FAIL] Expected 409 status code, but got ${approveRes.status}`);
  }
  if (approveJson.success !== false || !approveJson.message.includes("Maximum member limit reached")) {
    throw new Error(`[FAIL] Unexpected response message: ${approveJson.message}`);
  }
  console.log("[PASS] API successfully blocked the approval with 409 status code and clean error message.");

  // Step 9: Verify database states remain unchanged
  console.log("Step 3: Checking database states...");
  const dbApp71 = await MembershipApplication.findById(app71._id).lean();
  console.log(` - Application status in DB: ${dbApp71.status}`);
  if (dbApp71.status !== "submitted") {
    throw new Error(`[FAIL] Application status changed to ${dbApp71.status}!`);
  }

  const dbUser71 = await User.findById(user71._id).lean();
  console.log(` - User isActive in DB: ${dbUser71.isActive}`);
  console.log(` - User memberId in DB: ${dbUser71.memberId}`);
  if (dbUser71.isActive !== false) {
    throw new Error("[FAIL] User isActive was set to true!");
  }
  if (dbUser71.memberId) {
    throw new Error("[FAIL] Member ID was generated!");
  }
  console.log("[PASS] Database states verified: no changes or member ID allocation occurred.");

  // Clean up E2E test data
  await User.deleteMany({ email: new RegExp("^" + testEmailPrefix) });
  await MembershipApplication.deleteMany({ applicationNumber: new RegExp("^E2E_CAP_") });
  console.log("\nCleanup completed.");

  await mongoose.disconnect();
  console.log("\n==================================================");
  console.log("E2E MEMBERSHIP CAPACITY LIMIT SUCCESSFUL");
  console.log("==================================================\n");
}

run().catch(async (err) => {
  console.error("Test failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
