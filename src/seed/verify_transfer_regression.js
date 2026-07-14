const mongoose = require("mongoose");
require("dotenv").config({ path: "d:/Glora/Gloaro-BE/.env" });
const User = require("../models/User");
const EnterpriseRecord = require("../models/EnterpriseRecord");
const MembershipApplication = require("../models/MembershipApplication");

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
  let region = await EnterpriseRecord.findOne({ module: "organization", type: "region", name: "Transfer Regression Region" });
  if (!region) {
    region = new EnterpriseRecord({ module: "organization", type: "region", name: "Transfer Regression Region", code: "TRR", status: "active" });
    await region.save();
  }
  let state = await EnterpriseRecord.findOne({ module: "organization", type: "state", name: "Transfer Regression State" });
  if (!state) {
    state = new EnterpriseRecord({ module: "organization", type: "state", name: "Transfer Regression State", code: "TRS", parent: region._id, status: "active" });
    await state.save();
  }
  let district = await EnterpriseRecord.findOne({ module: "organization", type: "district", name: "Transfer Regression District" });
  if (!district) {
    district = new EnterpriseRecord({ module: "organization", type: "district", name: "Transfer Regression District", code: "TRD", parent: state._id, status: "active" });
    await district.save();
  }
  let chapterA = await EnterpriseRecord.findOne({ module: "organization", type: "chapter", name: "Regression Chapter A" });
  if (!chapterA) {
    chapterA = new EnterpriseRecord({ module: "organization", type: "chapter", name: "Regression Chapter A", code: "RCA", parent: district._id, status: "active" });
    await chapterA.save();
  }
  let chapterB = await EnterpriseRecord.findOne({ module: "organization", type: "chapter", name: "Regression Chapter B" });
  if (!chapterB) {
    chapterB = new EnterpriseRecord({ module: "organization", type: "chapter", name: "Regression Chapter B", code: "RCB", parent: district._id, status: "active" });
    await chapterB.save();
  }

  // 2. Clean previous E2E test data
  const testEmailPrefix = "e2e_reg_";
  await User.deleteMany({ email: new RegExp("^" + testEmailPrefix) });
  await MembershipApplication.deleteMany({ email: new RegExp("^" + testEmailPrefix) });
  console.log("Database cleaned.");

  // 3. Hydrate Chapter A with 70 active members
  console.log("Hydrating Chapter A with 70 active members...");
  const mockUsersA = [];
  for (let i = 1; i <= 70; i++) {
    const user = new User({
      name: `E2E Regression Member A_${i}`,
      email: `${testEmailPrefix}member_a_${i}@gloaro.com`,
      phone: `92100000${String(i).padStart(2, "0")}`,
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
    mockUsersA.push(user);
  }
  await User.insertMany(mockUsersA);

  // 4. Hydrate Chapter B with 69 active members
  console.log("Hydrating Chapter B with 69 active members...");
  const mockUsersB = [];
  for (let i = 1; i <= 69; i++) {
    const user = new User({
      name: `E2E Regression Member B_${i}`,
      email: `${testEmailPrefix}member_b_${i}@gloaro.com`,
      phone: `92200000${String(i).padStart(2, "0")}`,
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
          chapter: chapterB._id.toString()
        }
      }]
    ]);
    mockUsersB.push(user);
  }
  await User.insertMany(mockUsersB);

  // Log in as Super Admin
  const adminAuth = await login("superadmin@vendordirectory.com", "Password@123");
  console.log("[PASS] Super Admin logged in.");

  const countA1 = await User.countDocuments({ role: "customer", "meta.adminProfile.organization.chapter": chapterA._id.toString(), isActive: true });
  const countB1 = await User.countDocuments({ role: "customer", "meta.adminProfile.organization.chapter": chapterB._id.toString(), isActive: true });
  console.log(`Initial Counts -> Chapter A: ${countA1}, Chapter B: ${countB1}`);
  if (countA1 !== 70 || countB1 !== 69) {
    throw new Error(`[FAIL] Initial counts incorrect! Expected A=70, B=69, got A=${countA1}, B=${countB1}`);
  }

  // Choose one user from Chapter A to transfer to Chapter B
  const userToTransfer = mockUsersA[0];
  console.log(`Step 1: Transferring user ${userToTransfer.email} from Chapter A -> Chapter B...`);

  const transferPayload = {
    organization: {
      region: region._id.toString(),
      state: state._id.toString(),
      district: district._id.toString(),
      chapter: chapterB._id.toString()
    }
  };

  const transferRes = await fetch(`${BASE_URL}/admin/admin-accounts/${userToTransfer._id}/transfer`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminAuth.accessToken}`
    },
    body: JSON.stringify(transferPayload)
  });

  if (transferRes.status !== 200) {
    const json = await transferRes.json();
    throw new Error(`[FAIL] Transfer failed: status ${transferRes.status}, error: ${JSON.stringify(json)}`);
  }
  console.log("[PASS] Transfer succeeded.");

  const countA2 = await User.countDocuments({ role: "customer", "meta.adminProfile.organization.chapter": chapterA._id.toString(), isActive: true });
  const countB2 = await User.countDocuments({ role: "customer", "meta.adminProfile.organization.chapter": chapterB._id.toString(), isActive: true });
  console.log(`Counts post-transfer -> Chapter A: ${countA2}, Chapter B: ${countB2}`);
  if (countA2 !== 69 || countB2 !== 70) {
    throw new Error(`[FAIL] Counts incorrect after transfer! Expected A=69, B=70, got A=${countA2}, B=${countB2}`);
  }

  // Create two pending applicant users
  const applicant1 = new User({
    name: "Pending Applicant 1",
    email: `${testEmailPrefix}applicant_1@gloaro.com`,
    phone: "9210000091",
    password: "Password@123",
    role: "customer",
    isActive: false,
    isEmailVerified: true
  });
  await applicant1.save();

  const applicant2 = new User({
    name: "Pending Applicant 2",
    email: `${testEmailPrefix}applicant_2@gloaro.com`,
    phone: "9210000092",
    password: "Password@123",
    role: "customer",
    isActive: false,
    isEmailVerified: true
  });
  await applicant2.save();

  // Create two pending applications for Chapter A
  const app1 = new MembershipApplication({
    applicationNumber: "APP-REG-001",
    submittedBy: applicant1._id,
    regionId: region._id,
    stateId: state._id,
    districtId: district._id,
    chapterId: chapterA._id,
    status: "submitted",
    personalInfo: { firstName: "Pending", lastName: "Applicant 1", email: applicant1.email, phone: applicant1.phone },
    businessInfo: { businessName: "Test 1" }
  });
  await app1.save();

  const app2 = new MembershipApplication({
    applicationNumber: "APP-REG-002",
    submittedBy: applicant2._id,
    regionId: region._id,
    stateId: state._id,
    districtId: district._id,
    chapterId: chapterA._id,
    status: "submitted",
    personalInfo: { firstName: "Pending", lastName: "Applicant 2", email: applicant2.email, phone: applicant2.phone },
    businessInfo: { businessName: "Test 2" }
  });
  await app2.save();

  console.log("Step 2: Approving pending applicant 1 for Chapter A...");
  const approveRes1 = await fetch(`${BASE_URL}/membership-applications/${app1._id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminAuth.accessToken}`
    },
    body: JSON.stringify({ status: "approved" })
  });

  if (approveRes1.status !== 200) {
    const json = await approveRes1.json();
    throw new Error(`[FAIL] Approval 1 failed: status ${approveRes1.status}, error: ${JSON.stringify(json)}`);
  }
  console.log("[PASS] Approval 1 succeeded.");

  const countA3 = await User.countDocuments({ role: "customer", "meta.adminProfile.organization.chapter": chapterA._id.toString(), isActive: true });
  console.log(`Counts post-approval -> Chapter A: ${countA3}, Chapter B: ${countB2}`);
  if (countA3 !== 70) {
    throw new Error(`[FAIL] Chapter A count incorrect after approval 1! Expected A=70, got A=${countA3}`);
  }

  console.log("Step 3: Attempting to approve pending applicant 2 for Chapter A (expecting rejection)...");
  const approveRes2 = await fetch(`${BASE_URL}/membership-applications/${app2._id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminAuth.accessToken}`
    },
    body: JSON.stringify({ status: "approved" })
  });

  console.log(`Approval 2 response status: ${approveRes2.status}`);
  const json2 = await approveRes2.json();
  console.log("Approval 2 response body:", JSON.stringify(json2, null, 2));

  if (approveRes2.status !== 409) {
    throw new Error(`[FAIL] Expected 409 status code, but got ${approveRes2.status}`);
  }
  console.log("[PASS] Second approval blocked cleanly with HTTP 409 Conflict.");

  const countA4 = await User.countDocuments({ role: "customer", "meta.adminProfile.organization.chapter": chapterA._id.toString(), isActive: true });
  console.log(`Final Counts -> Chapter A: ${countA4}, Chapter B: ${countB2}`);
  if (countA4 !== 70) {
    throw new Error(`[FAIL] Chapter A count incorrect after rejected approval 2! Expected A=70, got A=${countA4}`);
  }

  // Clean up E2E test data
  await User.deleteMany({ email: new RegExp("^" + testEmailPrefix) });
  await MembershipApplication.deleteMany({ email: new RegExp("^" + testEmailPrefix) });
  console.log("Cleanup completed.");

  await mongoose.disconnect();
  console.log("\n==================================================");
  console.log("E2E MEMBER TRANSFER REGRESSION AUDIT SUCCESSFUL");
  console.log("==================================================\n");
}

run().catch(async (err) => {
  console.error("Test failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
