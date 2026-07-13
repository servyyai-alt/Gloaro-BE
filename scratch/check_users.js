require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  
  const u = await User.findById('6a4de5ed1a0f4fc74ecf09a0');
  if (u) {
    console.log(`User details - Name: ${u.name}, Email: ${u.email}, Role: ${u.role}, vendorProfile:`, JSON.stringify(u.vendorProfile));
  } else {
    console.log('User not found by ID 6a4de5ed1a0f4fc74ecf09a0');
  }
  
  await mongoose.disconnect();
}

run().catch(console.error);
