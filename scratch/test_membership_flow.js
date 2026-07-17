require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const MembershipApplication = require('../src/models/MembershipApplication');
const { processMembershipApproval } = require('../src/helpers/approvalHelper');

async function test() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/gloaro";
  console.log('Connecting to MongoDB at:', uri);
  await mongoose.connect(uri);
  console.log('Connected!');

  // 1. Create or Find Customer Test User
  let customerUser = await User.findOne({ email: 'customer_test_membership@example.com' });
  if (!customerUser) {
    customerUser = await User.create({
      name: 'Customer Membership Test',
      email: 'customer_test_membership@example.com',
      password: 'password123',
      role: 'customer',
      status: 'pending_approval' // Starts as pending_approval
    });
    console.log('Created Customer User:', customerUser.name);
  } else {
    console.log('Found existing Customer User:', customerUser.name);
    // Reset status to pending_approval
    customerUser.status = 'pending_approval';
    await customerUser.save();
  }

  // 2. Create or Find Reviewer User
  let reviewerUser = await User.findOne({ email: 'admin_test_membership@example.com' });
  if (!reviewerUser) {
    reviewerUser = await User.create({
      name: 'Admin Reviewer Test',
      email: 'admin_test_membership@example.com',
      password: 'password123',
      role: 'admin',
      status: 'approved'
    });
    console.log('Created Reviewer:', reviewerUser.name);
  } else {
    console.log('Found existing Reviewer:', reviewerUser.name);
  }

  // 3. Clear existing application
  await MembershipApplication.deleteMany({ submittedBy: customerUser._id });
  console.log('Cleared existing membership applications.');

  // 4. Create Draft application
  let app = await MembershipApplication.create({
    applicationNumber: 'GLR-MEMB-99999',
    status: 'draft',
    submittedBy: customerUser._id,
    personal: {
      fullName: 'Customer Membership Test',
      emailAddress: 'customer_test_membership@example.com',
      mobileNumber: '9876543210'
    },
    address: {
      line1: '123 Test St',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600001'
    },
    professional: {
      companyName: 'Test Corp',
      designation: 'Architect',
      industry: 'Technology',
      businessType: 'Startup'
    },
    regionId: new mongoose.Types.ObjectId("6a4b3cc81b8e8d7eaa36880a"), // South Region
    stateId: new mongoose.Types.ObjectId("6a4b429a88f2087730038d8b"),  // Tamil Nadu State
    districtId: new mongoose.Types.ObjectId("6a4cf0da7b28ab56afbccfaa"), // Chennai District
    chapterId: new mongoose.Types.ObjectId("6a4cf29b7b28ab56afbcd044")  // Ambathur Chapter
  });
  console.log('1. Created Draft Application. Status:', app.status);

  // 5. Submit Application (Status -> submitted)
  app.status = 'submitted';
  app.workflowHistory.push({
    user: customerUser._id,
    role: 'customer',
    action: 'submitted',
    remarks: 'Application submitted',
    timestamp: new Date()
  });
  await app.save();
  console.log('2. Submitted Application. Status:', app.status);

  // 6. Review: Request Changes
  app = await processMembershipApproval(
    app._id,
    'changes_requested',
    'Please fix designation spelling.',
    reviewerUser,
    '127.0.0.1',
    'Mozilla'
  );
  console.log('3. Reviewed: Changes Requested. Notes:', app.adminNotes);

  // 7. Customer resubmits
  app.status = 'submitted';
  app.workflowHistory.push({
    user: customerUser._id,
    role: 'customer',
    action: 'submitted',
    remarks: 'Updated designation spelling',
    timestamp: new Date()
  });
  await app.save();
  console.log('4. Resubmitted Application. Status:', app.status);

  // 8. Review: Approve
  app = await processMembershipApproval(
    app._id,
    'approved',
    'Onboarding looks perfect! Approved.',
    reviewerUser,
    '127.0.0.1',
    'Mozilla'
  );
  console.log('5. Reviewed: Approved. Status:', app.status);

  // Check updated user state
  const updatedUser = await User.findById(customerUser._id);
  console.log('\n--- VERIFY USER STATUS AND ID ---');
  console.log('User status:', updatedUser.status);
  console.log('User memberId:', updatedUser.memberId);

  await mongoose.disconnect();
  console.log('Disconnected.');
}

test().catch(console.error);
