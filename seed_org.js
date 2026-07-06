require('dotenv').config();
const mongoose = require('mongoose');
const EnterpriseRecord = require('./src/models/EnterpriseRecord');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  // Clear existing organization records
  await EnterpriseRecord.deleteMany({ module: 'organization' });
  console.log('Cleared existing organization records');

  // 1. Region
  const region = await EnterpriseRecord.create({
    module: 'organization',
    type: 'region',
    name: 'South India',
    code: 'SI',
    status: 'active'
  });
  console.log('Created Region:', region.name, region._id);

  // 2. State
  const state = await EnterpriseRecord.create({
    module: 'organization',
    type: 'state',
    name: 'Tamil Nadu',
    code: 'TN',
    parent: region._id,
    status: 'active'
  });
  console.log('Created State:', state.name, state._id);

  // 3. District
  const district = await EnterpriseRecord.create({
    module: 'organization',
    type: 'district',
    name: 'Chennai',
    code: 'CH',
    parent: state._id,
    status: 'active'
  });
  console.log('Created District:', district.name, district._id);

  // 4. Chapter (parent is District!)
  const chapter = await EnterpriseRecord.create({
    module: 'organization',
    type: 'chapter',
    name: 'Tambaram East',
    code: 'TE',
    parent: district._id,
    status: 'active'
  });
  console.log('Created Chapter:', chapter.name, chapter._id);

  console.log('Database Seeding Complete!');
  await mongoose.disconnect();
}

run().catch(console.error);
