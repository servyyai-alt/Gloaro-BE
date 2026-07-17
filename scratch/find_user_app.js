require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const MembershipApplication = require('../src/models/MembershipApplication');

async function check() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/gloaro";
  await mongoose.connect(uri);
  
  const user = await User.findOne({ email: 'dheenadhayalan.dk@gmail.com' });
  console.log('--- USER RECORD ---');
  console.log(user);

  if (user) {
    const app = await MembershipApplication.findOne({ submittedBy: user._id });
    console.log('--- MEMBERSHIP APPLICATION ---');
    console.log(app);
  } else {
    console.log('User not found in DB!');
  }

  await mongoose.disconnect();
}

check().catch(console.error);
