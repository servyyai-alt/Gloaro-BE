require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Vendor = require('../src/models/Vendor');
const VendorApplication = require('../src/models/VendorApplication');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  
  const app = await VendorApplication.findOne({ user: '6a4de5ed1a0f4fc74ecf09a0' });
  const vendor = await Vendor.findOne({ user: '6a4de5ed1a0f4fc74ecf09a0' });
  
  console.log('VendorApplication status:', app ? app.status : 'None');
  console.log('Vendor Document status:', vendor ? vendor.status : 'None', 'ID:', vendor ? vendor._id : 'None');
  
  if (app && app.status === 'approved' && vendor) {
    console.log('Syncing user vendorProfile...');
    const user = await User.findById('6a4de5ed1a0f4fc74ecf09a0');
    user.vendorProfile = {
      status: 'approved',
      vendorId: vendor._id,
      approvedAt: new Date()
    };
    await user.save({ validateBeforeSave: false });
    console.log('User synced successfully!');
  }

  await mongoose.disconnect();
}

run().catch(console.error);
