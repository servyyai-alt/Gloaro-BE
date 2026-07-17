const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: 'D:/Gloaro/Gloaro-BE/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const emails = ['mem6@gmail.com', 'mem5@gmail.com', 'mem4@gmail.com', 'mem1@gmail.com'];
  const users = await User.find({ email: { $in: emails } });
  for (const u of users) {
    console.log(u.email, 'referredBy:', u.referredBy);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
