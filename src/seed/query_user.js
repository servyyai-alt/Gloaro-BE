const mongoose = require("mongoose");
require("dotenv").config({ path: "d:/Glora/Gloaro-BE/.env" });
const User = require("../models/User");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to database.");

  const usersWithChapter = await User.find({
    "meta.adminProfile.organization.chapter": { $exists: true }
  }).limit(10).lean();

  console.log(`Found ${usersWithChapter.length} users with chapter in meta:`);
  usersWithChapter.forEach(u => {
    console.log(`User: ${u._id} (${u.name}, Role: ${u.role}, Email: ${u.email})`);
    console.log(` - Meta Chapter: ${u.meta?.adminProfile?.organization?.chapter}`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
