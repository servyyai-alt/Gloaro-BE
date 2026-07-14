const mongoose = require("mongoose");
require("dotenv").config({ path: "d:/Glora/Gloaro-BE/.env" });
const MembershipApplication = require("../models/MembershipApplication");
const User = require("../models/User");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to database.");

  const apps = await MembershipApplication.find().limit(10).populate("submittedBy", "name email role").lean();
  console.log(`Found ${apps.length} membership applications:`);
  apps.forEach(app => {
    console.log(`Application: ${app.applicationNumber}`);
    console.log(` - Status: ${app.status}`);
    console.log(` - Chapter ID: ${app.chapterId}`);
    console.log(` - Submitted By: ${app.submittedBy?._id} (${app.submittedBy?.name}, Role: ${app.submittedBy?.role})`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
