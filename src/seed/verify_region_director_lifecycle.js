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

  // 1. Find a region
  let region = await EnterpriseRecord.findOne({ module: "organization", type: "region" });
  if (!region) {
    console.log("Creating a mock Region in DB...");
    region = new EnterpriseRecord({
      module: "organization",
      type: "region",
      name: "E2E Test Region",
      code: "TR",
      status: "active"
    });
    await region.save();
  }
  console.log(`Using Region: ${region.name} (ID: ${region._id})`);

  // 2. Clean previous test user
  const email = "e2e_region_director@gloaro.com";
  await User.deleteMany({ email });
  console.log("Database cleaned for E2E Region Director.");

  console.log("\n==================================================");
  console.log("E2E REGION DIRECTOR LIFECYCLE AUDIT");
  console.log("==================================================\n");

  // Step 1: Login as Admin
  console.log("Step 1: Logging in as Admin...");
  const adminAuth = await login("admin@vendordirectory.com", "Admin@123");
  console.log(`[PASS] Admin logged in successfully.`);

  // Step 2: Create Region Director
  console.log("Step 2: Creating a new Region Director...");
  const createRes = await fetch(`${BASE_URL}/admin/admin-accounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminAuth.accessToken}`
    },
    body: JSON.stringify({
      name: "E2E Region Director",
      email,
      phone: "9988776655",
      password: "Password@123",
      role: "region_director",
      organization: {
        region: region._id.toString()
      }
    })
  });

  if (createRes.status !== 200 && createRes.status !== 201) {
    const errText = await createRes.text();
    throw new Error(`Failed to create Region Director: ${errText}`);
  }
  const createJson = await createRes.json();
  const createdUser = createJson.data;
  console.log(`[PASS] Region Director account created: ${createdUser.email} (officialId: ${createdUser.officialId})`);

  // Step 3: Verify created document details in DB
  const userInDb = await User.findOne({ email }).lean();
  const dbOrg = userInDb.meta?.adminProfile?.organization || {};
  console.log("Step 3: Auditing database state...");
  if (userInDb.role !== "region_director") throw new Error("Role mismatch in DB!");
  if (dbOrg.region?.toString() !== region._id.toString()) throw new Error("Region mapping mismatch in DB!");
  console.log("[PASS] Database role and region assignment successfully validated.");

  // Step 4: Login as the new Region Director
  console.log("Step 4: Logging in as the new Region Director...");
  const rdAuth = await login(email, "Password@123");
  console.log(`[PASS] Region Director successfully logged in.`);

  // Step 5: Verify dashboard loading
  console.log("Step 5: Testing /admin/dashboard...");
  const dashRes = await fetch(`${BASE_URL}/admin/dashboard`, {
    headers: { "Authorization": `Bearer ${rdAuth.accessToken}` }
  });
  console.log(`Dashboard response status: ${dashRes.status}`);
  if (dashRes.status !== 200) {
    const errText = await dashRes.text();
    throw new Error(`Dashboard fetch failed: ${errText}`);
  }
  console.log("[PASS] Region Director Dashboard loaded successfully.");

  // Step 6: Verify organization master loading (locations)
  console.log("Step 6: Testing /organization/locations (Organization Master)...");
  const locRes = await fetch(`${BASE_URL}/organization/locations`, {
    headers: { "Authorization": `Bearer ${rdAuth.accessToken}` }
  });
  console.log(`Locations response status: ${locRes.status}`);
  if (locRes.status !== 200) {
    const errText = await locRes.text();
    throw new Error(`Locations fetch failed: ${errText}`);
  }
  const locJson = await locRes.json();
  const locations = locJson.data?.locations || [];
  console.log(`Returned locations count: ${locations.length}`);
  
  // Scoping check: Ensure no parent region (other than their assigned one) is visible
  let hasOtherRegions = false;
  locations.forEach(loc => {
    if (loc.type === "region" && loc._id.toString() !== region._id.toString()) {
      hasOtherRegions = true;
    }
  });
  if (hasOtherRegions) {
    throw new Error("[FAIL] Scoping violation: Other regions visible to Region Director!");
  }
  console.log("[PASS] Organization Master loads scoped locations successfully (no parent region leak).");

  // Step 7: Verify reports loading
  console.log("Step 7: Testing /reports/analytics...");
  const repRes = await fetch(`${BASE_URL}/reports/analytics`, {
    headers: { "Authorization": `Bearer ${rdAuth.accessToken}` }
  });
  console.log(`Analytics response status: ${repRes.status}`);
  if (repRes.status !== 200) {
    const errText = await repRes.text();
    throw new Error(`Analytics fetch failed: ${errText}`);
  }
  console.log("[PASS] Reports analytics loaded successfully.");

  // Cleanup E2E user to prevent cluttering the database
  await User.deleteMany({ email });
  console.log("Cleanup completed.");

  await mongoose.disconnect();
  console.log("\n==================================================");
  console.log("E2E LIFECYCLE AUDIT SUCCESSFUL");
  console.log("==================================================\n");
}

run().catch(async (err) => {
  console.error("Test failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
