require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const permissionService = require('../src/services/permission.service');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  
  const user = await User.findOne({ email: 'vendor@vendordirectory.com' });
  if (!user) {
    console.log('User not found');
    return;
  }
  
  console.log('User:', user.name, 'Role:', user.role);
  
  const hasPerm = await permissionService.hasPermission(user._id, 'vendor', 'vendors.view');
  console.log('hasPermission(vendors.view):', hasPerm);
  
  const hasPerm2 = await permissionService.hasPermission(user._id, 'vendor', 'products.view');
  console.log('hasPermission(products.view):', hasPerm2);

  await mongoose.disconnect();
}

run().catch(console.error);
