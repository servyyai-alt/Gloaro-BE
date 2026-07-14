const mongoose = require("mongoose");
require("dotenv").config({ path: "d:/Glora/Gloaro-BE/.env" });
const User = require("../models/User");
const Vendor = require("../models/Vendor");
const Product = require("../models/Product");
const Category = require("../models/Category");
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

  // 1. Get or create Regions
  let regionNorth = await EnterpriseRecord.findOne({ module: "organization", type: "region", name: "North Region" });
  if (!regionNorth) {
    regionNorth = new EnterpriseRecord({ module: "organization", type: "region", name: "North Region", code: "NR", status: "active" });
    await regionNorth.save();
  }
  let regionSouth = await EnterpriseRecord.findOne({ module: "organization", type: "region", name: "South Region" });
  if (!regionSouth) {
    regionSouth = new EnterpriseRecord({ module: "organization", type: "region", name: "South Region", code: "SR", status: "active" });
    await regionSouth.save();
  }

  // 2. Clear previous E2E test data
  const testEmailPrefix = "e2e_marketplace_";
  await User.deleteMany({ email: new RegExp("^" + testEmailPrefix) });
  await Vendor.deleteMany({ email: new RegExp("^" + testEmailPrefix) });
  await Product.deleteMany({ title: new RegExp("^E2E_Test_Product_") });

  console.log("Cleaned old E2E marketplace data.");

  // 6. Find category IDs
  const Category = mongoose.model("Category");
  let bizCategory = await Category.findOne({ type: "business" });
  if (!bizCategory) {
    bizCategory = new Category({ name: "E2E Business Category", type: "business", isActive: true });
    await bizCategory.save();
  }
  let category = await Category.findOne({ type: "product" });
  if (!category) {
    category = new Category({ name: "E2E Products Category", type: "product", isActive: true });
    await category.save();
  }

  // 3. Create Vendor A (Approved, North Region)
  const userA = new User({ name: "User A", email: "e2e_marketplace_vendor_a@gloaro.com", phone: "1111111111", password: "Password@123", role: "vendor", isEmailVerified: true });
  await userA.save();
  const vendorA = new Vendor({
    user: userA._id,
    businessName: "E2E Vendor A (Approved NR)",
    ownerName: "Owner A",
    email: "e2e_marketplace_vendor_a@gloaro.com",
    phone: "1111111111",
    status: "approved",
    isActive: true,
    regionId: regionNorth._id,
    address: { street: "123 E2E St", city: "City A", state: "State A", pincode: "111111" },
    businessCategory: bizCategory._id
  });
  await vendorA.save();

  // 4. Create Vendor B (Pending, North Region)
  const userB = new User({ name: "User B", email: "e2e_marketplace_vendor_b@gloaro.com", phone: "2222222222", password: "Password@123", role: "vendor", isEmailVerified: true });
  await userB.save();
  const vendorB = new Vendor({
    user: userB._id,
    businessName: "E2E Vendor B (Pending NR)",
    ownerName: "Owner B",
    email: "e2e_marketplace_vendor_b@gloaro.com",
    phone: "2222222222",
    status: "pending",
    isActive: true,
    regionId: regionNorth._id,
    address: { street: "123 E2E St", city: "City A", state: "State A", pincode: "111111" },
    businessCategory: bizCategory._id
  });
  await vendorB.save();

  // 5. Create Vendor C (Approved, South Region)
  const userC = new User({ name: "User C", email: "e2e_marketplace_vendor_c@gloaro.com", phone: "3333333333", password: "Password@123", role: "vendor", isEmailVerified: true });
  await userC.save();
  const vendorC = new Vendor({
    user: userC._id,
    businessName: "E2E Vendor C (Approved SR)",
    ownerName: "Owner C",
    email: "e2e_marketplace_vendor_c@gloaro.com",
    phone: "3333333333",
    status: "approved",
    isActive: true,
    regionId: regionSouth._id,
    address: { street: "123 E2E St", city: "City A", state: "State A", pincode: "111111" },
    businessCategory: bizCategory._id
  });
  await vendorC.save();

  // 7. Create Products
  const prodA = new Product({
    vendor: vendorA._id,
    title: "E2E_Test_Product_A (Vendor A)",
    category: category._id,
    pricing: { mrp: 100, sellingPrice: 90 },
    status: "approved"
  });
  await prodA.save();

  const prodB = new Product({
    vendor: vendorB._id,
    title: "E2E_Test_Product_B (Vendor B)",
    category: category._id,
    pricing: { mrp: 150, sellingPrice: 120 },
    status: "approved"
  });
  await prodB.save();

  const prodC = new Product({
    vendor: vendorC._id,
    title: "E2E_Test_Product_C (Vendor C)",
    category: category._id,
    pricing: { mrp: 200, sellingPrice: 180 },
    status: "approved"
  });
  await prodC.save();

  // 8. Create a North Region Director to test E2E Scoping
  const rdUser = new User({
    name: "E2E North Region Director",
    email: "e2e_marketplace_rd_north@gloaro.com",
    phone: "8888888888",
    password: "Password@123",
    role: "region_director",
    isEmailVerified: true,
    status: "approved"
  });
  rdUser.meta = new Map([
    ["adminProfile", {
      organization: {
        region: regionNorth._id.toString()
      }
    }]
  ]);
  await rdUser.save();

  console.log("Mock data set up successfully.");

  console.log("\n==================================================");
  console.log("E2E MARKETPLACE SCOPING & FILTERING AUDIT");
  console.log("==================================================\n");

  // Scenario 1: Public guest requests (without authorization headers)
  console.log("Scenario 1: Fetching products as a public guest...");
  const publicRes = await fetch(`${BASE_URL}/products?limit=100`);
  const publicJson = await publicRes.json();
  const publicProducts = publicJson.data || [];
  const publicTestProds = publicProducts.filter(p => p.title.startsWith("E2E_Test_Product_"));
  console.log(`Guest sees ${publicTestProds.length} test products.`);
  publicTestProds.forEach(p => console.log(` - Title: ${p.title}, Vendor: ${p.vendor?.businessName}`));

  const hasProdA = publicTestProds.some(p => p.title.includes("Product_A"));
  const hasProdB = publicTestProds.some(p => p.title.includes("Product_B"));
  const hasProdC = publicTestProds.some(p => p.title.includes("Product_C"));

  if (!hasProdA || !hasProdC) {
    throw new Error("[FAIL] Public guest should see products of all approved vendors (A & C)!");
  }
  if (hasProdB) {
    throw new Error("[FAIL] Public guest should NOT see products from pending/rejected vendors (B)!");
  }
  console.log("[PASS] Guest scoping and approval filtering verified.");

  // Scenario 2: Super Admin requests
  console.log("\nScenario 2: Fetching products as Super Admin...");
  const adminAuth = await login("admin@vendordirectory.com", "Admin@123");
  const adminRes = await fetch(`${BASE_URL}/products?limit=100`, {
    headers: { "Authorization": `Bearer ${adminAuth.accessToken}` }
  });
  const adminJson = await adminRes.json();
  const adminProducts = adminJson.data || [];
  const adminTestProds = adminProducts.filter(p => p.title.startsWith("E2E_Test_Product_"));
  console.log(`Super Admin sees ${adminTestProds.length} test products.`);

  if (!adminTestProds.some(p => p.title.includes("Product_A")) || !adminTestProds.some(p => p.title.includes("Product_C"))) {
    throw new Error("[FAIL] Super Admin should see products of all approved vendors!");
  }
  if (adminTestProds.some(p => p.title.includes("Product_B"))) {
    throw new Error("[FAIL] Super Admin should NOT see products from pending/rejected vendors!");
  }
  console.log("[PASS] Super Admin visibility verified.");

  // Scenario 3: North Region Director requests (scoping to North Region approved vendors only)
  console.log("\nScenario 3: Fetching products as North Region Director...");
  const rdAuth = await login("e2e_marketplace_rd_north@gloaro.com", "Password@123");
  const rdRes = await fetch(`${BASE_URL}/products?limit=100`, {
    headers: { "Authorization": `Bearer ${rdAuth.accessToken}` }
  });
  const rdJson = await rdRes.json();
  const rdProducts = rdJson.data || [];
  const rdTestProds = rdProducts.filter(p => p.title.startsWith("E2E_Test_Product_"));
  console.log(`North Region Director sees ${rdTestProds.length} test products.`);
  rdTestProds.forEach(p => console.log(` - Title: ${p.title}, Vendor: ${p.vendor?.businessName}`));

  const hasOnlyNorthApproved = rdTestProds.every(p => p.title.includes("Product_A"));
  const missingNorthApproved = !rdTestProds.some(p => p.title.includes("Product_A"));

  if (missingNorthApproved) {
    throw new Error("[FAIL] North Region Director should see Product A!");
  }
  if (!hasOnlyNorthApproved) {
    throw new Error("[FAIL] North Region Director should NOT see Product C (South Region) or Product B (Pending)!");
  }
  console.log("[PASS] Region Director scoping verified (Vendor A only, Vendor B & C excluded).");

  // Clean up
  await User.deleteMany({ email: new RegExp("^" + testEmailPrefix) });
  await Vendor.deleteMany({ email: new RegExp("^" + testEmailPrefix) });
  await Product.deleteMany({ title: new RegExp("^E2E_Test_Product_") });
  console.log("\nCleanup completed.");

  await mongoose.disconnect();
  console.log("\n==================================================");
  console.log("E2E MARKETPLACE SCOPING & FILTERING SUCCESSFUL");
  console.log("==================================================\n");
}

run().catch(async (err) => {
  console.error("Test failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
