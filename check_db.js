require('dotenv').config();
const mongoose = require('mongoose');
const EnterpriseRecord = require('./src/models/EnterpriseRecord');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  
  const count = await EnterpriseRecord.countDocuments({});
  console.log('Total EnterpriseRecord count:', count);
  
  const orgRecords = await EnterpriseRecord.find({ module: 'organization' });
  console.log('Organization module count:', orgRecords.length);
  orgRecords.forEach(r => {
    console.log(`- ${r.name} (${r.type}) status=${r.status} _id=${r._id} parent=${r.parent}`);
  });
  
  await mongoose.disconnect();
}

run().catch(console.error);
