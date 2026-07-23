const { ROLES } = require("../constants/roleConfig");
const EnterpriseRecord = require("../models/EnterpriseRecord");
const User = require("../models/User");
const { AppError } = require("../middleware/errorHandler");

/**
 * Validate selected Region, State, District, and Chapter
 * and resolve the complete organizational hierarchy.
 */
const resolveHierarchy = async (locationData) => {
  const { regionId, stateId, districtId, chapterId } = locationData;

  if (!chapterId) throw new AppError("Chapter selection is required", 400);

  // 1. Resolve Chapter
  const chapter = await EnterpriseRecord.findOne({ _id: chapterId, type: "chapter" });
  if (!chapter) throw new AppError("Invalid Chapter selected", 404);

  // 2. Resolve District
  const district = await EnterpriseRecord.findOne({ _id: districtId || chapter.parent, type: "district" });
  if (!district) throw new AppError("Invalid District selected", 404);

  if (chapter.parent && chapter.parent.toString() !== district._id.toString()) {
    throw new AppError("Selected Chapter does not belong to the selected District", 400);
  }

  // 3. Resolve State
  const state = await EnterpriseRecord.findOne({ _id: stateId || district.parent, type: "state" });
  if (!state) throw new AppError("Invalid State selected", 404);

  if (district.parent && district.parent.toString() !== state._id.toString()) {
    throw new AppError("Selected District does not belong to the selected State", 400);
  }

  // 4. Resolve Region
  const region = await EnterpriseRecord.findOne({ _id: regionId || state.parent, type: "region" });
  if (!region) throw new AppError("Invalid Region selected", 404);

  if (state.parent && state.parent.toString() !== region._id.toString()) {
    throw new AppError("Selected State does not belong to the selected Region", 400);
  }

  return { region, state, district, chapter };
};

/**
 * Helper to find user ID matching role and organization location
 */
const findOfficialByRoleAndLocation = async (roleValues, locationType, record) => {
  if (!record) return null;

  const roles = Array.isArray(roleValues) ? roleValues : [roleValues];
  
  const filter = {
    role: { $in: roles },
    $or: [
      { [`meta.adminProfile.organization.${locationType}`]: record._id.toString() },
      { [`meta.adminProfile.organization.${locationType}`]: record.code },
      { [`meta.adminProfile.organization.${locationType}`]: record.name }
    ]
  };

  const user = await User.findOne(filter).select("_id");
  return user ? user._id : null;
};

/**
 * Finds all assigned officials for the resolved hierarchy.
 */
const resolveOfficials = async (hierarchy) => {
  const { region, state, district, chapter } = hierarchy;

  // Resolve Vice President
  let vicePresidentId = chapter.assignedTo || chapter.metadata?.vicePresident;
  if (!vicePresidentId) {
    vicePresidentId = await findOfficialByRoleAndLocation(ROLES.VICE_PRESIDENT, "chapter", chapter);
  }

  // Resolve Chapter President
  let chapterPresidentId = chapter.director;
  if (!chapterPresidentId) {
    chapterPresidentId = await findOfficialByRoleAndLocation(ROLES.CHAPTER_PRESIDENT, "chapter", chapter);
  }

  // Resolve Direct Consultant (Assigned at Chapter level under simplified hierarchy)
  let directConsultantId = chapter.metadata?.directConsultant;
  if (!directConsultantId) {
    directConsultantId = await findOfficialByRoleAndLocation(ROLES.DIRECT_CONSULTANT, "chapter", chapter);
  }

  // Resolve Launch Director (Assigned at Chapter level under simplified hierarchy)
  let launchDirectorId = chapter.metadata?.launchDirector;
  if (!launchDirectorId) {
    launchDirectorId = await findOfficialByRoleAndLocation(ROLES.LAUNCH_DIRECTOR, "chapter", chapter);
  }

  // Resolve Executive Director
  let executiveDirectorId = district.assignedTo || district.metadata?.executiveDirector;
  if (!executiveDirectorId) {
    executiveDirectorId = await findOfficialByRoleAndLocation(ROLES.EXECUTIVE_DIRECTOR, "district", district);
  }

  // Resolve District Director
  let districtDirectorId = district.director || district.metadata?.districtDirector;
  if (!districtDirectorId) {
    districtDirectorId = await findOfficialByRoleAndLocation(ROLES.DISTRICT_DIRECTOR, "district", district);
  }

  // Resolve State Director
  let stateDirectorId = state.director || state.metadata?.stateDirector;
  if (!stateDirectorId) {
    stateDirectorId = await findOfficialByRoleAndLocation(ROLES.STATE_DIRECTOR, "state", state);
  }

  // Resolve Region Director
  let regionDirectorId = region.director || region.metadata?.regionDirector;
  if (!regionDirectorId) {
    regionDirectorId = await findOfficialByRoleAndLocation(ROLES.REGION_DIRECTOR, "region", region);
  }

  // Assign a default admin if there is one
  const adminUser = await User.findOne({ role: ROLES.ADMIN }).select("_id");
  const assignedAdminId = adminUser ? adminUser._id : null;

  return {
    vicePresidentId: vicePresidentId || null,
    chapterPresidentId: chapterPresidentId || null,
    directConsultantId: directConsultantId || null,
    launchDirectorId: launchDirectorId || null,
    executiveDirectorId: executiveDirectorId || null,
    districtDirectorId: districtDirectorId || null,
    stateDirectorId: stateDirectorId || null,
    regionDirectorId: regionDirectorId || null,
    assignedAdminId: assignedAdminId || null,
  };
};

module.exports = {
  resolveHierarchy,
  resolveOfficials,
};
