require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const users = await User.find({ role: 'customer' });
  console.log(`Found ${users.length} customer users:`);
  users.forEach(u => {
    console.log(`- Name: ${u.name}, Email: ${u.email}, memberId: ${u.memberId}, officialId: ${u.officialId}, status: ${u.status}, isActive: ${u.isActive}`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
