require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Category = require("../models/Category");
const Vendor = require("../models/Vendor");
const { MembershipPlan } = require("../models/Membership");
const Banner = require("../models/Banner");
const FAQ = require("../models/FAQ");
const Setting = require("../models/Setting");
const logger = require("../utils/logger");

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  logger.info("MongoDB connected for seeding");
};

const seedUsers = async () => {
  await User.deleteMany({
    email: {
      $in: [
        "superadmin@vendordirectory.com",
        "admin@vendordirectory.com",
        "vendor@vendordirectory.com",
        "user@vendordirectory.com",
        "customer@vendordirectory.com",
      ],
    },
  });

  const users = [
    {
      name: "Super Admin",
      email: "superadmin@vendordirectory.com",
      password: "SuperAdmin@123",
      role: "superadmin",
      isEmailVerified: true,
      isActive: true,
    },
    {
      name: "Admin User",
      email: "admin@vendordirectory.com",
      password: "Admin@123",
      role: "admin",
      isEmailVerified: true,
      isActive: true,
    },
    {
      name: "Test Vendor",
      email: "vendor@vendordirectory.com",
      password: "Vendor@123",
      role: "vendor",
      phone: "9876543210",
      isEmailVerified: true,
      isActive: true,
    },
    {
      name: "Test Customer",
      email: "customer@vendordirectory.com",
      password: "Customer@123",
      role: "customer",
      phone: "9876543211",
      isEmailVerified: true,
      isActive: true,
    },
  ];

  const created = await User.create(users);
  logger.info(`✅ Seeded ${created.length} users`);
  return created;
};

const seedCMS = async () => {
  await Promise.all([
    Banner.deleteMany({}),
    FAQ.deleteMany({}),
    Setting.deleteMany({}),
  ]);

  const [banners, faqs, settings] = await Promise.all([
    Banner.insertMany([
      {
        title: "Grow with Gloaro",
        subtitle: "Connect with verified businesses, services, and products near you.",
        placement: "home",
        order: 1,
        isActive: true,
      },
      {
        title: "Premium Vendor Memberships",
        subtitle: "Unlock featured listings, analytics, and priority support.",
        placement: "directory",
        order: 2,
        isActive: true,
      },
    ]),
    FAQ.insertMany([
      {
        question: "How do I become a vendor?",
        answer: "Create an account, submit your business profile, and wait for admin verification.",
        category: "vendors",
        order: 1,
      },
      {
        question: "How do customers contact vendors?",
        answer: "Customers can submit enquiries from vendor, product, or service pages.",
        category: "customers",
        order: 2,
      },
      {
        question: "How are memberships activated?",
        answer: "Free plans activate immediately. Paid plans activate after successful Razorpay payment verification.",
        category: "memberships",
        order: 3,
      },
    ]),
    Setting.insertMany([
      { key: "platform.name", value: "Gloaro", group: "platform", isPublic: true },
      { key: "platform.currency", value: "INR", group: "payments", isPublic: true },
      { key: "support.email", value: "support@leastaction.in", group: "support", isPublic: true },
    ]),
  ]);

  logger.info(`✅ Seeded ${banners.length} banners, ${faqs.length} FAQs, ${settings.length} settings`);
};

const seedCategories = async () => {
  await Category.deleteMany({});

  const businessCategories = [
    { name: "Technology", type: "business", icon: "💻", description: "IT services, software, hardware" },
    { name: "Food & Beverage", type: "business", icon: "🍔", description: "Restaurants, cafes, food production" },
    { name: "Healthcare", type: "business", icon: "🏥", description: "Hospitals, clinics, medical services" },
    { name: "Education", type: "business", icon: "📚", description: "Schools, coaching, training institutes" },
    { name: "Retail", type: "business", icon: "🛍️", description: "Shops, malls, e-commerce" },
    { name: "Manufacturing", type: "business", icon: "🏭", description: "Production, factory, industrial" },
    { name: "Real Estate", type: "business", icon: "🏠", description: "Properties, construction, interior" },
    { name: "Finance", type: "business", icon: "💰", description: "Banking, insurance, investment" },
    { name: "Logistics", type: "business", icon: "🚚", description: "Transport, warehousing, supply chain" },
    { name: "Marketing", type: "business", icon: "📢", description: "Advertising, digital marketing, PR" },
  ];

  const productCategories = [
    { name: "Electronics", type: "product", icon: "📱" },
    { name: "Clothing & Fashion", type: "product", icon: "👗" },
    { name: "Home & Garden", type: "product", icon: "🏡" },
    { name: "Sports & Fitness", type: "product", icon: "⚽" },
    { name: "Books & Stationery", type: "product", icon: "📖" },
    { name: "Automotive", type: "product", icon: "🚗" },
    { name: "Food & Groceries", type: "product", icon: "🛒" },
    { name: "Beauty & Personal Care", type: "product", icon: "💄" },
  ];

  const serviceCategories = [
    { name: "Web Development", type: "service", icon: "🌐" },
    { name: "Digital Marketing", type: "service", icon: "📊" },
    { name: "Photography", type: "service", icon: "📸" },
    { name: "Consulting", type: "service", icon: "💼" },
    { name: "Accounting & Tax", type: "service", icon: "📋" },
    { name: "Legal Services", type: "service", icon: "⚖️" },
    { name: "Event Management", type: "service", icon: "🎉" },
    { name: "Home Services", type: "service", icon: "🔧" },
  ];

  const all = [...businessCategories, ...productCategories, ...serviceCategories];
  const created = await Category.create(all);
  logger.info(`✅ Seeded ${created.length} categories`);
  return created;
};

const seedMembershipPlans = async () => {
  await MembershipPlan.deleteMany({});

  const plans = [
    {
      name: "free",
      displayName: "Free",
      description: "Get started with basic listing",
      price: { monthly: 0, yearly: 0 },
      features: [
        { name: "Products", value: 5 },
        { name: "Services", value: 3 },
        { name: "Images per listing", value: 3 },
        { name: "Leads per month", value: 10 },
        { name: "Email support", value: true },
      ],
      limits: { products: 5, services: 3, images: 3, leads: 10, featuredListing: false, verifiedBadge: false, prioritySupport: false, analyticsAccess: false, customBranding: false },
      isActive: true,
      order: 1,
      color: "#6B7280",
    },
    {
      name: "silver",
      displayName: "Silver",
      description: "Perfect for growing businesses",
      price: { monthly: 999, yearly: 9999 },
      features: [
        { name: "Products", value: 25 },
        { name: "Services", value: 15 },
        { name: "Images per listing", value: 10 },
        { name: "Leads per month", value: 50 },
        { name: "Verified Badge", value: true },
        { name: "Priority support", value: false },
        { name: "Analytics", value: "basic" },
      ],
      limits: { products: 25, services: 15, images: 10, leads: 50, featuredListing: false, verifiedBadge: true, prioritySupport: false, analyticsAccess: true, customBranding: false },
      isActive: true,
      order: 2,
      color: "#9CA3AF",
    },
    {
      name: "gold",
      displayName: "Gold",
      description: "For established businesses",
      price: { monthly: 2499, yearly: 24999 },
      features: [
        { name: "Products", value: 100 },
        { name: "Services", value: 50 },
        { name: "Images per listing", value: 20 },
        { name: "Leads per month", value: 200 },
        { name: "Verified Badge", value: true },
        { name: "Featured listing", value: true, isHighlighted: true },
        { name: "Priority support", value: true },
        { name: "Advanced Analytics", value: true },
      ],
      limits: { products: 100, services: 50, images: 20, leads: 200, featuredListing: true, verifiedBadge: true, prioritySupport: true, analyticsAccess: true, customBranding: false },
      isActive: true,
      order: 3,
      color: "#F59E0B",
    },
    {
      name: "platinum",
      displayName: "Platinum",
      description: "Maximum visibility & features",
      price: { monthly: 4999, yearly: 49999 },
      features: [
        { name: "Unlimited Products", value: "unlimited", isHighlighted: true },
        { name: "Unlimited Services", value: "unlimited", isHighlighted: true },
        { name: "Unlimited Images", value: "unlimited" },
        { name: "Unlimited Leads", value: "unlimited" },
        { name: "Verified Badge", value: true },
        { name: "Priority Featured listing", value: true, isHighlighted: true },
        { name: "Dedicated support", value: true, isHighlighted: true },
        { name: "Full Analytics", value: true },
        { name: "Custom Branding", value: true, isHighlighted: true },
      ],
      limits: { products: -1, services: -1, images: -1, leads: -1, featuredListing: true, verifiedBadge: true, prioritySupport: true, analyticsAccess: true, customBranding: true },
      isActive: true,
      order: 4,
      color: "#7C3AED",
    },
  ];

  const created = await MembershipPlan.insertMany(plans);
  logger.info(`✅ Seeded ${created.length} membership plans`);
  return created;
};

const runSeed = async () => {
  try {
    await connectDB();
    logger.info("🌱 Starting database seeding...");

    await seedUsers();
    const categories = await seedCategories();
    await seedMembershipPlans();
    await seedCMS();

    logger.info("✅ Database seeding completed successfully!");
    logger.info("\n📋 Test Credentials:");
    logger.info("  Super Admin: superadmin@vendordirectory.com / SuperAdmin@123");
    logger.info("  Admin: admin@vendordirectory.com / Admin@123");
    logger.info("  Vendor: vendor@vendordirectory.com / Vendor@123");
    logger.info("  Customer: customer@vendordirectory.com / Customer@123");

    process.exit(0);
  } catch (err) {
    logger.error("Seeding failed:", err);
    process.exit(1);
  }
};

runSeed();
