const mongoose = require("mongoose");
const User = require("../models/User");

const getUserMeta = (user) => {
  if (!user?.meta) return {};
  if (typeof user.toObject === "function") {
    return user.toObject({ flattenMaps: true }).meta || {};
  }
  if (user.meta instanceof Map) return Object.fromEntries(user.meta);
  return user.meta;
};

const getUserOrg = (user) => {
  const meta = getUserMeta(user);
  return meta?.adminProfile?.organization || {};
};

const getScopedUserFilter = (user) => {
  if (!user) return {};
  const isGlobal = ["superadmin", "admin"].includes(user?.role);
  if (isGlobal) return {};

  const org = getUserOrg(user);

  if (user.role === "region_director") {
    if (!org.region) return { _id: null }; // block if no region assigned
    return { "meta.adminProfile.organization.region": org.region.toString() };
  }
  if (user.role === "state_director") {
    if (!org.state) return { _id: null };
    return { "meta.adminProfile.organization.state": org.state.toString() };
  }
  if (user.role === "district_director") {
    if (!org.district) return { _id: null };
    return { "meta.adminProfile.organization.district": org.district.toString() };
  }
  
  // Executive Director, Launch Director, Direct Consultant, Chapter President, Vice President, Secretary
  if (!org.chapter) return { _id: null };
  return { "meta.adminProfile.organization.chapter": org.chapter.toString() };
};

const getAllowedUserIds = async (user) => {
  const isGlobal = ["superadmin", "admin"].includes(user?.role);
  if (isGlobal) return null;

  const filter = getScopedUserFilter(user);
  const users = await User.find(filter).select("_id").lean();
  return users.map(u => u._id);
};

const getScopedVendorFilter = (user) => {
  if (!user) return {};
  const isGlobal = ["superadmin", "admin"].includes(user?.role);
  if (isGlobal) return {};

  const org = getUserOrg(user);

  if (user.role === "region_director") {
    if (!org.region) return { _id: null };
    return { regionId: new mongoose.Types.ObjectId(org.region) };
  }
  if (user.role === "state_director") {
    if (!org.state) return { _id: null };
    return { stateId: new mongoose.Types.ObjectId(org.state) };
  }
  if (user.role === "district_director") {
    if (!org.district) return { _id: null };
    return { districtId: new mongoose.Types.ObjectId(org.district) };
  }

  // Chapter-level roles
  if (!org.chapter) return { _id: null };
  return { chapterId: new mongoose.Types.ObjectId(org.chapter) };
};

module.exports = {
  getUserMeta,
  getUserOrg,
  getScopedUserFilter,
  getAllowedUserIds,
  getScopedVendorFilter,
};
