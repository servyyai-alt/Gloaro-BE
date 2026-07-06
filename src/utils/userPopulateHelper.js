const EnterpriseRecord = require("../models/EnterpriseRecord");

async function populateUserOrganizationLocations(users) {
  if (!users || users.length === 0) return users;

  // Extract all unique ObjectIds from organization meta
  const locationIds = new Set();
  users.forEach(u => {
    // meta is a Mongoose Map, so we access it using u.meta.get('adminProfile') or direct properties if it's a plain object
    const metaObj = u.meta && typeof u.meta.get === "function" ? u.meta.get("adminProfile") : u.meta?.adminProfile;
    const org = metaObj?.organization || {};
    if (org.region) locationIds.add(org.region.toString());
    if (org.state) locationIds.add(org.state.toString());
    if (org.district) locationIds.add(org.district.toString());
    if (org.chapter) locationIds.add(org.chapter.toString());
  });

  if (locationIds.size === 0) return users;

  const records = await EnterpriseRecord.find({ _id: { $in: Array.from(locationIds) } })
    .select("_id name code type")
    .lean();

  const recordMap = {};
  records.forEach(r => {
    recordMap[r._id.toString()] = { _id: r._id, name: r.name, code: r.code, type: r.type };
  });

  // Map populated records back
  const plainUsers = users.map(u => {
    const plain = u.toObject ? u.toObject({ flattenMaps: true }) : JSON.parse(JSON.stringify(u));
    const org = plain.meta?.adminProfile?.organization || {};
    
    if (org.region && recordMap[org.region.toString()]) {
      org.assignedRegion = recordMap[org.region.toString()];
    }
    if (org.state && recordMap[org.state.toString()]) {
      org.assignedState = recordMap[org.state.toString()];
    }
    if (org.district && recordMap[org.district.toString()]) {
      org.assignedDistrict = recordMap[org.district.toString()];
    }
    if (org.chapter && recordMap[org.chapter.toString()]) {
      org.assignedChapter = recordMap[org.chapter.toString()];
    }

    if (!plain.meta) plain.meta = {};
    if (!plain.meta.adminProfile) plain.meta.adminProfile = {};
    plain.meta.adminProfile.organization = org;

    return plain;
  });

  return plainUsers;
}

module.exports = { populateUserOrganizationLocations };
