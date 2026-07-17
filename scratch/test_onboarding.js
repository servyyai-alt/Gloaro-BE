require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const CustomerOnboarding = require('../src/models/CustomerOnboarding');
const AuditLog = require('../src/models/AuditLog');
const Notification = require('../src/models/Notification');

async function test() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/gloaro";
  console.log('Connecting to MongoDB at:', uri);
  await mongoose.connect(uri);
  console.log('Connected!');

  // 1. Create or Find Customer Test User
  let customerUser = await User.findOne({ email: 'customer_test@example.com' });
  if (!customerUser) {
    customerUser = await User.create({
      name: 'Customer Test',
      email: 'customer_test@example.com',
      password: 'password123',
      role: 'customer',
      status: 'approved' // Initial account status (can access system, but onboarding block applies)
    });
    console.log('Created Customer User:', customerUser.name);
  } else {
    console.log('Found existing Customer User:', customerUser.name);
  }

  // 2. Create or Find VP Reviewer User
  let reviewerUser = await User.findOne({ email: 'vp_test@example.com' });
  if (!reviewerUser) {
    reviewerUser = await User.create({
      name: 'Vice President Test',
      email: 'vp_test@example.com',
      password: 'password123',
      role: 'vice_president',
      status: 'approved'
    });
    console.log('Created VP Reviewer:', reviewerUser.name);
  } else {
    console.log('Found existing VP Reviewer:', reviewerUser.name);
  }

  // 3. Clear existing onboarding and audit logs for this user to start clean
  await CustomerOnboarding.deleteMany({ user: customerUser._id });
  await AuditLog.deleteMany({ resourceId: { $in: [customerUser._id] } });
  console.log('Cleared existing test onboarding records.');

  // 4. Create Draft Onboarding Application
  let onboarding = await CustomerOnboarding.create({
    user: customerUser._id,
    status: 'Draft',
    step1: {
      fullName: 'Customer Test',
      dateOfBirth: '1990-01-01',
      gender: 'Male',
      phone: '9876543210',
      address: {
        street: '123 Test St',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
      }
    },
    step2: {
      occupation: 'Developer',
      companyName: 'Test Inc',
      industry: 'Technology',
      experienceYears: 5
    },
    step3: {
      reasonForJoining: 'Networking',
      referralSource: 'Word of Mouth',
      termsAccepted: true
    }
  });
  console.log('1. Onboarding Draft Created. Status:', onboarding.status);

  // 5. Submit Onboarding (Status -> Pending)
  onboarding.status = 'Pending';
  onboarding.workflowHistory.push({
    user: customerUser._id,
    userName: customerUser.name,
    role: customerUser.role,
    action: 'Submit',
    comments: 'Submitting onboarding application for review.'
  });
  await onboarding.save();
  console.log('2. Application Submitted. Status:', onboarding.status);

  // 6. Review Onboarding (Status -> ChangesRequested)
  onboarding.status = 'ChangesRequested';
  onboarding.reviewerComments = 'Please update your company name to represent full corporate name.';
  onboarding.workflowHistory.push({
    user: reviewerUser._id,
    userName: reviewerUser.name,
    role: reviewerUser.role,
    action: 'Request Changes',
    comments: onboarding.reviewerComments
  });
  await onboarding.save();
  console.log('3. Reviewed: Request Changes. Comments:', onboarding.reviewerComments);

  // 7. Customer Resubmits (Status -> Pending)
  onboarding.step2.companyName = 'Test Corporate Inc';
  onboarding.status = 'Pending';
  onboarding.workflowHistory.push({
    user: customerUser._id,
    userName: customerUser.name,
    role: customerUser.role,
    action: 'Resubmit',
    comments: 'Updated company name as requested.'
  });
  await onboarding.save();
  console.log('4. Application Resubmitted. New Company:', onboarding.step2.companyName);

  // 8. Review Onboarding (Status -> Approved)
  onboarding.status = 'Approved';
  onboarding.workflowHistory.push({
    user: reviewerUser._id,
    userName: reviewerUser.name,
    role: reviewerUser.role,
    action: 'Approve',
    comments: 'Onboarding approved successfully. Welcome to the portal!'
  });
  await onboarding.save();
  console.log('5. Application Approved. Status:', onboarding.status);

  // 9. Inspect audit history logs
  const updatedOnboarding = await CustomerOnboarding.findOne({ user: customerUser._id });
  console.log('\n--- VERIFY WORKFLOW HISTORY AUDIT ---');
  updatedOnboarding.workflowHistory.forEach((h, index) => {
    console.log(`[Step ${index + 1}] At ${h.timestamp.toISOString()} - User: ${h.userName} (${h.role}) did Action: "${h.action}" with Comments: "${h.comments}"`);
  });

  await mongoose.disconnect();
  console.log('Disconnected.');
}

test().catch(console.error);
