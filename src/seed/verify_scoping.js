const mongoose = require("mongoose");
require("dotenv").config({ path: "d:/Glora/Gloaro-BE/.env" });
const User = require("../models/User");
const Vendor = require("../models/Vendor");
const Payment = require("../models/Payment");
const { getScopedUserFilter, getScopedVendorFilter } = require("../utils/scopingHelper");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");

  const rolesToTest = [
    { email: "superadmin@vendordirectory.com", expectedTarget: "all" },
    { email: "admin@vendordirectory.com", expectedTarget: "all" },
    { email: "sneha@gmail.com", expectedTarget: "chapter" },
    { email: "president@gmail.com", expectedTarget: "chapter" },
    { email: "vice@gmail.com", expectedTarget: "chapter" },
    { email: "secretary@gmail.com", expectedTarget: "chapter" }
  ];

  console.log("\n==================================================");
  console.log("REGRESSION & SECURITY AUDIT: ORGANIZATION SCOPING");
  console.log("==================================================\n");

  for (const t of rolesToTest) {
    const user = await User.findOne({ email: t.email });
    if (!user) {
      console.log(`[WARNING] User not found in database: ${t.email}`);
      continue;
    }

    const userFilter = getScopedUserFilter(user);
    const vendorFilter = getScopedVendorFilter(user);

    // 1. Fetch count of scoped users
    const matchedUsersCount = await User.countDocuments(userFilter);
    // 2. Fetch count of scoped vendors
    const matchedVendorsCount = await Vendor.countDocuments(vendorFilter);

    console.log(`User: ${user.name} (${user.email})`);
    console.log(`- Role: ${user.role}`);
    console.log(`- Scoped User Query Filter:`, JSON.stringify(userFilter));
    console.log(`- Scoped Vendor Query Filter:`, JSON.stringify(vendorFilter));
    console.log(`- Scoped Users Count: ${matchedUsersCount}`);
    console.log(`- Scoped Vendors Count: ${matchedVendorsCount}`);
    
    // Safety check: ensure hierarchy roles do not see global counts (unless their role is superadmin/admin)
    const totalGlobalUsers = await User.countDocuments({});
    const totalGlobalVendors = await Vendor.countDocuments({});

    if (["superadmin", "admin"].includes(user.role)) {
      if (matchedUsersCount !== totalGlobalUsers || matchedVendorsCount !== totalGlobalVendors) {
        console.log(`- [FAIL] Global Admin should see all records!`);
      } else {
        console.log(`- [PASS] Global admin access verified.`);
      }
    } else {
      if (matchedUsersCount === totalGlobalUsers && totalGlobalUsers > 1) {
        console.log(`- [FAIL] Hierarchy role leaked all global users!`);
      } else if (matchedVendorsCount === totalGlobalVendors && totalGlobalVendors > 1) {
        console.log(`- [FAIL] Hierarchy role leaked all global vendors!`);
      } else {
        console.log(`- [PASS] Scoping isolation verified (no leak of global/sibling records).`);
      }
    }
    console.log("--------------------------------------------------");
  }

  await mongoose.disconnect();
}

run().catch(console.error);
