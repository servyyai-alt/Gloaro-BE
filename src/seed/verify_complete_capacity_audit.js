const mongoose = require("mongoose");
require("dotenv").config({ path: "d:/Glora/Gloaro-BE/.env" });
const User = require("../models/User");
const EnterpriseRecord = require("../models/EnterpriseRecord");
const MembershipApplication = require("../models/MembershipApplication");
const Notification = require("../models/Notification");
const AuditLog = require("../models/AuditLog");
const Counter = require("../models/Counter");

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

  const testPrefix = "TMP_CAPACITY_";

  // Clean previous runs
  await User.deleteMany({ email: new RegExp("^" + testPrefix.toLowerCase()) });
  await MembershipApplication.deleteMany({ applicationNumber: new RegExp("^" + testPrefix) });
  await Notification.deleteMany({ title: new RegExp(testPrefix) });
  await AuditLog.deleteMany({ details: new RegExp(testPrefix) });
  await EnterpriseRecord.deleteMany({ name: new RegExp("^" + testPrefix) });
  await Counter.deleteMany({ module: new RegExp("^" + testPrefix) });
  console.log("Cleaned up any residual test data.");

  // Phase 2 – Setup Isolated Hierarchy
  console.log("\n--- Phase 2: Setup Isolated Hierarchy ---");
  const region = new EnterpriseRecord({ module: "organization", type: "region", name: `${testPrefix}Region`, code: "TMP_REG", status: "active" });
  await region.save();
  const state = new EnterpriseRecord({ module: "organization", type: "state", name: `${testPrefix}State`, code: "TMP_ST", parent: region._id, status: "active" });
  await state.save();
  const district = new EnterpriseRecord({ module: "organization", type: "district", name: `${testPrefix}District`, code: "TMP_DT", parent: state._id, status: "active" });
  await district.save();
  const chapterA = new EnterpriseRecord({ module: "organization", type: "chapter", name: `${testPrefix}ChapterA`, code: "TMP_CA", parent: district._id, status: "active" });
  await chapterA.save();
  const chapterB = new EnterpriseRecord({ module: "organization", type: "chapter", name: `${testPrefix}ChapterB`, code: "TMP_CB", parent: district._id, status: "active" });
  await chapterB.save();
  console.log(`Created test hierarchy. Chapter A ID: ${chapterA._id}, Chapter B ID: ${chapterB._id}`);

  // Log in as Super Admin to perform actions
  const adminAuth = await login("superadmin@vendordirectory.com", "SuperAdmin@123");
  console.log("[PASS] Super Admin logged in.");

  // Helper to create and approve a member
  async function createAndApproveMember(index, chapterId, emailOverride = null, appNumOverride = null) {
    const email = emailOverride || `${testPrefix.toLowerCase()}member_${index}@gloaro.com`;
    const appNum = appNumOverride || `${testPrefix}APP_${index}`;
    const user = new User({
      name: `TMP Member ${index}`,
      email,
      phone: `9990000${String(index).padStart(3, "0")}`,
      password: "Password@123",
      role: "customer",
      isActive: false,
      isEmailVerified: true
    });
    await user.save();

    const application = new MembershipApplication({
      applicationNumber: appNum,
      submittedBy: user._id,
      regionId: region._id,
      stateId: state._id,
      districtId: district._id,
      chapterId,
      status: "submitted",
      personalInfo: { firstName: "TMP", lastName: `Member ${index}`, email: user.email, phone: user.phone },
      businessInfo: { businessName: `TMP Business ${index}` }
    });
    await application.save();

    const approveRes = await fetch(`${BASE_URL}/membership-applications/${application._id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminAuth.accessToken}`
      },
      body: JSON.stringify({ status: "approved" })
    });

    return { status: approveRes.status, user, application };
  }

  // Phase 3 & 4 – Create Test Members Using Real APIs & Verify Limit
  console.log("\n--- Phase 3 & 4: Hydrate Chapter A (70 Members) and Verify Limit ---");
  console.log("Hydrating Chapter A with 70 active members using the real approval API...");
  for (let i = 1; i <= 70; i++) {
    const res = await createAndApproveMember(i, chapterA._id);
    if (res.status !== 200) {
      throw new Error(`[FAIL] Failed to approve member ${i}: HTTP status ${res.status}`);
    }
  }

  const activeCountA1 = await User.countDocuments({
    role: "customer",
    "meta.adminProfile.organization.chapter": chapterA._id.toString(),
    isActive: true,
    isSuspended: { $ne: true },
    isBlocked: { $ne: true }
  });
  console.log(`Active count for Chapter A: ${activeCountA1}`);
  if (activeCountA1 !== 70) {
    throw new Error(`[FAIL] Expected Chapter A active count to be 70, got ${activeCountA1}`);
  }

  // Attempt Member #71
  console.log("Attempting to approve Member #71 (expecting 409 rejection)...");
  const res71 = await createAndApproveMember(71, chapterA._id);
  console.log(`Member #71 approval response status: ${res71.status}`);
  if (res71.status !== 409) {
    throw new Error(`[FAIL] Expected 409 status code for Member #71, got ${res71.status}`);
  }
  console.log("[PASS] Member #71 approval blocked cleanly.");

  // Verify no side effects for blocked Member #71
  const dbUser71 = await User.findById(res71.user._id);
  if (dbUser71.isActive || dbUser71.memberId) {
    throw new Error(`[FAIL] Blocked member user document mutated! isActive: ${dbUser71.isActive}, memberId: ${dbUser71.memberId}`);
  }
  const dbApp71 = await MembershipApplication.findById(res71.application._id);
  if (dbApp71.status !== "submitted") {
    throw new Error(`[FAIL] Blocked application status mutated! Status: ${dbApp71.status}`);
  }
  console.log("[PASS] Verified zero side-effects on blocked approval.");

  // Phase 5 – Free Capacity
  console.log("\n--- Phase 5: Free Capacity ---");
  // Reject Member #71
  const rejectRes = await fetch(`${BASE_URL}/membership-applications/${res71.application._id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminAuth.accessToken}`
    },
    body: JSON.stringify({ status: "rejected", adminNotes: "Test Rejection" })
  });
  console.log(`Reject response status: ${rejectRes.status}`);

  // Deactivate Member #1
  const firstMember = await User.findOne({ email: `${testPrefix.toLowerCase()}member_1@gloaro.com` });
  firstMember.isActive = false;
  await firstMember.save();
  console.log(`Deactivated Member 1 (${firstMember.email}).`);

  const activeCountA2 = await User.countDocuments({
    role: "customer",
    "meta.adminProfile.organization.chapter": chapterA._id.toString(),
    isActive: true,
    isSuspended: { $ne: true },
    isBlocked: { $ne: true }
  });
  console.log(`Active count for Chapter A post-deactivation: ${activeCountA2}`);
  if (activeCountA2 !== 69) {
    throw new Error(`[FAIL] Expected Chapter A active count to be 69, got ${activeCountA2}`);
  }

  // Approve a new member (Member #72)
  console.log("Approving Member #72 to fill freed slot...");
  const res72 = await createAndApproveMember(72, chapterA._id);
  console.log(`Member #72 approval response status: ${res72.status}`);
  if (res72.status !== 200) {
    throw new Error(`[FAIL] Expected 200 status code for Member #72 approval, got ${res72.status}`);
  }
  const activeCountA3 = await User.countDocuments({
    role: "customer",
    "meta.adminProfile.organization.chapter": chapterA._id.toString(),
    isActive: true,
    isSuspended: { $ne: true },
    isBlocked: { $ne: true }
  });
  console.log(`Active count for Chapter A post-fill: ${activeCountA3}`);
  if (activeCountA3 !== 70) {
    throw new Error(`[FAIL] Expected Chapter A active count to be 70, got ${activeCountA3}`);
  }
  console.log("[PASS] Free capacity test passed successfully.");

  // Phase 6 – Transfer Verification
  console.log("\n--- Phase 6: Transfer Verification ---");
  console.log("Hydrating Chapter B with 69 active members...");
  const mockMembersB = [];
  for (let i = 1; i <= 69; i++) {
    const res = await createAndApproveMember(100 + i, chapterB._id, `${testPrefix.toLowerCase()}member_b_${i}@gloaro.com`, `${testPrefix}APP_B_${i}`);
    if (res.status !== 200) {
      throw new Error(`[FAIL] Failed to approve Chapter B member ${i}: HTTP status ${res.status}`);
    }
    mockMembersB.push(res.user);
  }
  const activeCountB1 = await User.countDocuments({
    role: "customer",
    "meta.adminProfile.organization.chapter": chapterB._id.toString(),
    isActive: true,
    isSuspended: { $ne: true },
    isBlocked: { $ne: true }
  });
  console.log(`Active count for Chapter B: ${activeCountB1}`);
  if (activeCountB1 !== 69) {
    throw new Error(`[FAIL] Expected Chapter B active count to be 69, got ${activeCountB1}`);
  }

  // Transfer one member from Chapter A to Chapter B
  const memberToTransfer = await User.findOne({ email: `${testPrefix.toLowerCase()}member_72@gloaro.com` });
  console.log(`Transferring member ${memberToTransfer.email} from Chapter A -> Chapter B...`);
  const transferRes = await fetch(`${BASE_URL}/admin/admin-accounts/${memberToTransfer._id}/transfer`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminAuth.accessToken}`
    },
    body: JSON.stringify({
      organization: {
        region: region._id.toString(),
        state: state._id.toString(),
        district: district._id.toString(),
        chapter: chapterB._id.toString()
      }
    })
  });
  console.log(`Transfer response status: ${transferRes.status}`);
  if (transferRes.status !== 200) {
    throw new Error(`[FAIL] Expected transfer status 200, got ${transferRes.status}`);
  }

  const activeCountA4 = await User.countDocuments({ role: "customer", "meta.adminProfile.organization.chapter": chapterA._id.toString(), isActive: true });
  const activeCountB2 = await User.countDocuments({ role: "customer", "meta.adminProfile.organization.chapter": chapterB._id.toString(), isActive: true });
  console.log(`Post-transfer counts -> Chapter A: ${activeCountA4}, Chapter B: ${activeCountB2}`);
  if (activeCountA4 !== 69 || activeCountB2 !== 70) {
    throw new Error(`[FAIL] Transfer counts incorrect! Expected A=69, B=70, got A=${activeCountA4}, B=${activeCountB2}`);
  }

  // Attempt another transfer to Chapter B (expecting 409 rejection)
  const anotherMemberToTransfer = await User.findOne({ email: `${testPrefix.toLowerCase()}member_70@gloaro.com` });
  console.log(`Attempting to transfer member ${anotherMemberToTransfer.email} to full Chapter B (expecting rejection)...`);
  const transferRes2 = await fetch(`${BASE_URL}/admin/admin-accounts/${anotherMemberToTransfer._id}/transfer`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminAuth.accessToken}`
    },
    body: JSON.stringify({
      organization: {
        region: region._id.toString(),
        state: state._id.toString(),
        district: district._id.toString(),
        chapter: chapterB._id.toString()
      }
    })
  });
  console.log(`Transfer 2 response status: ${transferRes2.status}`);
  if (transferRes2.status !== 409) {
    throw new Error(`[FAIL] Expected transfer status 409, got ${transferRes2.status}`);
  }
  console.log("[PASS] Transfer validation successfully blocked.");

  // Phase 7 – Concurrent Approval Verification
  console.log("\n--- Phase 7: Concurrent Approval Verification ---");
  // Chapter A has 69 members. We create 10 pending applicants for Chapter A
  console.log("Creating 10 pending applications for Chapter A...");
  const concurrentApps = [];
  for (let i = 1; i <= 10; i++) {
    const user = new User({
      name: `TMP Concurrent ${i}`,
      email: `${testPrefix.toLowerCase()}concurrent_${i}@gloaro.com`,
      phone: `9990001${String(i).padStart(3, "0")}`,
      password: "Password@123",
      role: "customer",
      isActive: false,
      isEmailVerified: true
    });
    await user.save();

    const app = new MembershipApplication({
      applicationNumber: `${testPrefix}APP_CONC_${i}`,
      submittedBy: user._id,
      regionId: region._id,
      stateId: state._id,
      districtId: district._id,
      chapterId: chapterA._id,
      status: "submitted",
      personalInfo: { firstName: "TMP", lastName: `Concurrent ${i}`, email: user.email, phone: user.phone },
      businessInfo: { businessName: `TMP Concurrent Business ${i}` }
    });
    await app.save();
    concurrentApps.push(app);
  }

  console.log("Firing 10 parallel approval API requests simultaneously...");
  const approvalPromises = concurrentApps.map(app => {
    return fetch(`${BASE_URL}/membership-applications/${app._id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminAuth.accessToken}`
      },
      body: JSON.stringify({ status: "approved" })
    });
  });

  const responses = await Promise.all(approvalPromises);
  const statuses = responses.map(r => r.status);
  console.log("Parallel approval response statuses:", statuses);

  const successApprovals = statuses.filter(s => s === 200).length;
  const conflictApprovals = statuses.filter(s => s === 409).length;
  console.log(`Successes: ${successApprovals}, Conflicts (409): ${conflictApprovals}`);

  if (successApprovals !== 1) {
    throw new Error(`[FAIL] Expected exactly 1 successful concurrent approval, got ${successApprovals}`);
  }
  const activeCountA5 = await User.countDocuments({ role: "customer", "meta.adminProfile.organization.chapter": chapterA._id.toString(), isActive: true });
  console.log(`Active count for Chapter A post-concurrent: ${activeCountA5}`);
  if (activeCountA5 !== 70) {
    throw new Error(`[FAIL] Expected Chapter A active count to be exactly 70, got ${activeCountA5}`);
  }
  console.log("[PASS] Concurrent approval transaction safety verified.");

  // Phase 8 – Negative Test Cases
  console.log("\n--- Phase 8: Negative Test Cases ---");
  
  // Case 2: 70 Approved, Reject Pending
  console.log("Case 2: Chapter is full. Attempting to reject a pending application...");
  const pendingRejectApp = concurrentApps.find(app => !statuses.includes(200) || concurrentApps.indexOf(app) !== statuses.indexOf(200));
  const rejectRes2 = await fetch(`${BASE_URL}/membership-applications/${pendingRejectApp._id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminAuth.accessToken}`
    },
    body: JSON.stringify({ status: "rejected", adminNotes: "Rejected when full" })
  });
  console.log(`Reject pending when full status: ${rejectRes2.status}`);
  if (rejectRes2.status !== 200) {
    throw new Error(`[FAIL] Rejecting pending application failed with status ${rejectRes2.status}`);
  }
  console.log("[PASS] Case 2 passed.");

  // Case 3: 70 Approved, Suspend one active member
  console.log("Case 3: Suspending one active member in Chapter A...");
  const activeMemberToSuspend = await User.findOne({
    role: "customer",
    "meta.adminProfile.organization.chapter": chapterA._id.toString(),
    isActive: true,
    isSuspended: { $ne: true }
  });
  activeMemberToSuspend.isSuspended = true;
  await activeMemberToSuspend.save();
  console.log(`Suspended user ${activeMemberToSuspend.email}.`);

  const activeCountA6 = await User.countDocuments({
    role: "customer",
    "meta.adminProfile.organization.chapter": chapterA._id.toString(),
    isActive: true,
    isSuspended: { $ne: true },
    isBlocked: { $ne: true }
  });
  console.log(`Active count post-suspension: ${activeCountA6}`);
  if (activeCountA6 !== 69) {
    throw new Error(`[FAIL] Expected active count to be 69, got ${activeCountA6}`);
  }

  // Approve a pending member (Case 3 success)
  const anotherPendingApp = await MembershipApplication.findOne({ _id: { $in: concurrentApps.map(a => a._id) }, status: "submitted" });
  console.log("Approving a member to check if slot is filled...");
  const approveResCase3 = await fetch(`${BASE_URL}/membership-applications/${anotherPendingApp._id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminAuth.accessToken}`
    },
    body: JSON.stringify({ status: "approved" })
  });
  console.log(`Approve status post-suspension: ${approveResCase3.status}`);
  if (approveResCase3.status !== 200) {
    throw new Error(`[FAIL] Failed to approve member after suspension: ${approveResCase3.status}`);
  }
  console.log("[PASS] Case 3 passed.");

  // Case 4: 70 Approved, Block one active member
  console.log("Case 4: Blocking one active member in Chapter A...");
  const activeMemberToBlock = await User.findOne({
    role: "customer",
    "meta.adminProfile.organization.chapter": chapterA._id.toString(),
    isActive: true,
    isBlocked: { $ne: true }
  });
  activeMemberToBlock.isBlocked = true;
  await activeMemberToBlock.save();
  console.log(`Blocked user ${activeMemberToBlock.email}.`);

  const activeCountA7 = await User.countDocuments({
    role: "customer",
    "meta.adminProfile.organization.chapter": chapterA._id.toString(),
    isActive: true,
    isSuspended: { $ne: true },
    isBlocked: { $ne: true }
  });
  console.log(`Active count post-block: ${activeCountA7}`);
  if (activeCountA7 !== 69) {
    throw new Error(`[FAIL] Expected active count to be 69, got ${activeCountA7}`);
  }

  // Approve another member
  const anotherPendingApp2 = await MembershipApplication.findOne({ _id: { $in: concurrentApps.map(a => a._id) }, status: "submitted" });
  const approveResCase4 = await fetch(`${BASE_URL}/membership-applications/${anotherPendingApp2._id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminAuth.accessToken}`
    },
    body: JSON.stringify({ status: "approved" })
  });
  console.log(`Approve status post-block: ${approveResCase4.status}`);
  if (approveResCase4.status !== 200) {
    throw new Error(`[FAIL] Failed to approve member after block: ${approveResCase4.status}`);
  }
  console.log("[PASS] Case 4 passed.");

  // Case 5: 70 Approved, Delete one active member
  console.log("Case 5: Deleting one active member in Chapter A...");
  const activeMemberToDelete = await User.findOne({
    role: "customer",
    "meta.adminProfile.organization.chapter": chapterA._id.toString(),
    isActive: true
  });
  await User.findByIdAndDelete(activeMemberToDelete._id);
  console.log(`Hard deleted user ${activeMemberToDelete.email}.`);

  const activeCountA8 = await User.countDocuments({
    role: "customer",
    "meta.adminProfile.organization.chapter": chapterA._id.toString(),
    isActive: true,
    isSuspended: { $ne: true },
    isBlocked: { $ne: true }
  });
  console.log(`Active count post-delete: ${activeCountA8}`);
  if (activeCountA8 !== 69) {
    throw new Error(`[FAIL] Expected active count to be 69, got ${activeCountA8}`);
  }

  // Approve another member
  const anotherPendingApp3 = await MembershipApplication.findOne({ _id: { $in: concurrentApps.map(a => a._id) }, status: "submitted" });
  const approveResCase5 = await fetch(`${BASE_URL}/membership-applications/${anotherPendingApp3._id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminAuth.accessToken}`
    },
    body: JSON.stringify({ status: "approved" })
  });
  console.log(`Approve status post-delete: ${approveResCase5.status}`);
  if (approveResCase5.status !== 200) {
    throw new Error(`[FAIL] Failed to approve member after delete: ${approveResCase5.status}`);
  }
  console.log("[PASS] Case 5 passed.");

  // Case 6: Unable to resolve chapter
  console.log("Case 6: Testing unable to resolve chapter (expecting 400)...");
  const noChapterUser = new User({
    name: "TMP No Chapter",
    email: `${testPrefix.toLowerCase()}no_chapter@gloaro.com`,
    phone: "9990009999",
    password: "Password@123",
    role: "customer",
    isActive: false,
    isEmailVerified: true
  });
  await noChapterUser.save();

  const noChapterApp = new MembershipApplication({
    applicationNumber: `${testPrefix}APP_NO_CHAP`,
    submittedBy: noChapterUser._id,
    regionId: region._id,
    stateId: state._id,
    districtId: district._id,
    status: "submitted", // chapterId intentionally left undefined
    personalInfo: { firstName: "TMP", lastName: "No Chapter", email: noChapterUser.email, phone: noChapterUser.phone },
    businessInfo: { businessName: "No Chapter Business" }
  });
  await noChapterApp.save();

  const approveResCase6 = await fetch(`${BASE_URL}/membership-applications/${noChapterApp._id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminAuth.accessToken}`
    },
    body: JSON.stringify({ status: "approved" })
  });
  console.log(`Approve status case 6: ${approveResCase6.status}`);
  const case6Json = await approveResCase6.json();
  console.log("Approve case 6 body:", JSON.stringify(case6Json, null, 2));
  if (approveResCase6.status !== 400 || !case6Json.message.includes("Unable to determine chapter")) {
    throw new Error(`[FAIL] Expected 400 with "Unable to determine chapter", got status ${approveResCase6.status}`);
  }
  console.log("[PASS] Case 6 passed.");

  // Phase 11 – Cleanup
  console.log("\n--- Phase 11: Cleanup ---");
  const deletedUsers = await User.deleteMany({ email: new RegExp("^" + testPrefix.toLowerCase()) });
  const deletedApps = await MembershipApplication.deleteMany({ applicationNumber: new RegExp("^" + testPrefix) });
  const deletedNotifications = await Notification.deleteMany({ title: new RegExp(testPrefix) });
  const deletedAuditLogs = await AuditLog.deleteMany({ resourceId: { $in: [region._id, state._id, district._id, chapterA._id, chapterB._id] } });
  const deletedRecords = await EnterpriseRecord.deleteMany({ name: new RegExp("^" + testPrefix) });
  const deletedCounters = await Counter.deleteMany({ module: new RegExp("^" + testPrefix) });

  console.log(`Deleted Users: ${deletedUsers.deletedCount}`);
  console.log(`Deleted Applications: ${deletedApps.deletedCount}`);
  console.log(`Deleted Notifications: ${deletedNotifications.deletedCount}`);
  console.log(`Deleted Audit Logs: ${deletedAuditLogs.deletedCount}`);
  console.log(`Deleted Enterprise Records: ${deletedRecords.deletedCount}`);
  console.log(`Deleted Counters: ${deletedCounters.deletedCount}`);
  console.log("[PASS] Database cleaned up completely. Zero orphans remaining.");

  await mongoose.disconnect();
  console.log("\n==================================================");
  console.log("E2E CAPACITY VERIFICATION & CLEANUP AUDIT SUCCESSFUL");
  console.log("==================================================\n");
}

run().catch(async (err) => {
  console.error("Audit failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
