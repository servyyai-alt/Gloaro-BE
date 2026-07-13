const Counter = require("../models/Counter");
const { AppError } = require("../middleware/errorHandler");

const GENERIC_MODULE_PREFIXES = {
  assignment: "ASN",
  vendor_management: "VDM",
  marketplace: "MKT",
  business_wall: "BWL",
  testimonial: "TST",
  report: "RPT",
  scorecard: "SCR",
  activity: "ACT",
  workflow: "WFL",
  referral_pipeline: "RFP",
  visitor_conversion: "VCN",
  attendance: "ATD",
  vendor_approval: "VAP",
  marketplace_approval: "MAP",
  notification_automation: "NAU",
  task: "TSK",
  calendar: "CAL",
  executive_dashboard: "EXD",
  chapter_dashboard: "CHD",
  member_journey: "MJR",
  ai_insight: "AII",
  membership_application: "APP",
};

class IdGeneratorService {
  async getNextSequence(module) {
    const counter = await Counter.findOneAndUpdate(
      { module: String(module).trim().toUpperCase() },
      { $inc: { sequence: 1 } },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    return counter.sequence;
  }

  pad(sequence, length = 3) {
    return String(sequence).padStart(length, "0");
  }

  year(date = new Date()) {
    return new Date(date).getFullYear();
  }

  dateKey(date = new Date()) {
    const value = new Date(date);
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  }

  normalize(value, label, { length, fallback } = {}) {
    const normalized = String(value ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    const finalValue = normalized || fallback;
    if (!finalValue) {
      throw new AppError(`${label} is required for ID generation`, 400);
    }

    return length ? finalValue.slice(0, length) : finalValue;
  }

  deriveCode(value, label, length) {
    const normalized = this.normalize(value, label);
    return normalized.slice(0, length);
  }

  trailingDigits(value, length = 3) {
    const normalized = this.normalize(value, "Code");
    const match = normalized.match(/(\d+)$/);
    if (!match) {
      throw new AppError(`Unable to derive numeric sequence from code "${value}"`, 400);
    }
    return match[1].slice(-length).padStart(length, "0");
  }

  compactExecutiveDirectorCode(value) {
    const normalized = this.normalize(value, "Executive Director code");
    if (/^ED\d+$/.test(normalized)) return normalized;
    return `ED${this.trailingDigits(normalized, 3)}`;
  }

  compactChapterCode(value) {
    const normalized = this.normalize(value, "Chapter code");
    if (/^CH\d+$/.test(normalized)) return normalized;
    return `CH${this.trailingDigits(normalized, 3)}`;
  }

  compactVendorCode(value) {
    const normalized = this.normalize(value, "Vendor code");
    if (/^VDR\d+$/.test(normalized)) return normalized;
    return `VDR${this.trailingDigits(normalized, 6)}`;
  }

  async generateRegionId(metadata = {}) {
    const zone = this.normalize(metadata.zone || metadata.regionCode, "Region zone", { length: 1 });
    const sequence = await this.getNextSequence(`region:${zone}`);
    return `REG-${zone}-${this.pad(sequence, 3)}`;
  }

  async generateStateId(metadata = {}) {
    const stateCode = this.normalize(metadata.stateCode || metadata.code || metadata.state, "State code", { length: 2 });
    const sequence = await this.getNextSequence(`state:${stateCode}`);
    return `ST-${stateCode}-${this.pad(sequence, 3)}`;
  }

  async generateAreaId(metadata = {}) {
    const stateCode = this.normalize(metadata.stateCode || metadata.state, "State code", { length: 2 });
    const areaCode = this.normalize(metadata.areaCode || metadata.cityCode || metadata.area || metadata.city, "Area code", { length: 3 });
    const sequence = await this.getNextSequence(`area:${stateCode}:${areaCode}`);
    return `AR-${stateCode}-${areaCode}-${this.pad(sequence, 3)}`;
  }

  async generateExecutiveDirectorId(metadata = {}) {
    const stateCode = this.normalize(metadata.stateCode || metadata.state, "State code", { length: 2 });
    const areaCode = this.normalize(metadata.areaCode || metadata.cityCode || metadata.area || metadata.city, "Area code", { length: 3 });
    const sequence = await this.getNextSequence(`executive_director:${stateCode}:${areaCode}`);
    return `ED-${stateCode}-${areaCode}-${this.pad(sequence, 3)}`;
  }

  async generateLaunchDirectorId(metadata = {}) {
    const stateCode = this.normalize(metadata.stateCode || metadata.state, "State code", { length: 2 });
    const areaCode = this.normalize(metadata.areaCode || metadata.cityCode || metadata.area || metadata.city, "Area code", { length: 3 });
    const sequence = await this.getNextSequence(`launch_director:${stateCode}:${areaCode}`);
    return `LD-${stateCode}-${areaCode}-${this.pad(sequence, 3)}`;
  }

  async generateDirectConsultantId(metadata = {}) {
    const stateCode = this.normalize(metadata.stateCode || metadata.state, "State code", { length: 2 });
    const areaCode = this.normalize(metadata.areaCode || metadata.cityCode || metadata.area || metadata.city, "Area code", { length: 3 });
    const sequence = await this.getNextSequence(`direct_consultant:${stateCode}:${areaCode}`);
    return `DC-${stateCode}-${areaCode}-${this.pad(sequence, 3)}`;
  }

  async generateChapterId(metadata = {}) {
    const stateCode = this.normalize(metadata.stateCode || metadata.state, "State code", { length: 2 });
    const areaCode = this.normalize(metadata.areaCode || metadata.cityCode || metadata.area || metadata.city, "Area code", { length: 3 });
    const executiveDirectorCode = this.compactExecutiveDirectorCode(
      metadata.executiveDirectorCode || metadata.executiveDirectorId || metadata.directorCode
    );
    const sequence = await this.getNextSequence(`chapter:${stateCode}:${areaCode}:${executiveDirectorCode}`);
    return `CH-${stateCode}-${areaCode}-${executiveDirectorCode}-${this.pad(sequence, 3)}`;
  }

  async generateMemberId(metadata = {}) {
    const stateCode = this.normalize(metadata.stateCode || metadata.state, "State code", { length: 2 });
    const districtCode = this.normalize(metadata.districtCode || metadata.district || metadata.areaCode || metadata.area || metadata.cityCode || metadata.city, "District code", { length: 3 });
    const sequence = await this.getNextSequence(`member:${stateCode}:${districtCode}`);
    return `MEM-${stateCode}-${districtCode}-${this.pad(sequence, 6)}`;
  }

  async generateVendorId(metadata = {}) {
    const stateCode = this.normalize(metadata.stateCode || metadata.state, "State code", { length: 2 });
    const districtCode = this.normalize(metadata.districtCode || metadata.district || metadata.areaCode || metadata.area || metadata.cityCode || metadata.city, "District code", { length: 3 });
    const sequence = await this.getNextSequence(`vendor:${stateCode}:${districtCode}`);
    return `VDR-${stateCode}-${districtCode}-${this.pad(sequence, 6)}`;
  }

  async generateVisitorId(metadata = {}) {
    const year = this.year(metadata.date);
    const sequence = await this.getNextSequence(`visitor:${year}`);
    return `VIS-${year}-${this.pad(sequence, 6)}`;
  }

  async generateReferralId(metadata = {}) {
    const sequence = await this.getNextSequence(`referral:global`);
    return `GLR-REF-${this.pad(sequence, 6)}`;
  }

  async generateMemberReferralCode(metadata = {}) {
    const sequence = await this.getNextSequence(`memberReferralCode:global`);
    return `GLR-${this.pad(sequence, 6)}`;
  }

  async generateMeetingId(metadata = {}) {
    const chapterCode = this.compactChapterCode(metadata.chapterCode || metadata.chapterId);
    const dateKey = this.dateKey(metadata.meetingDate || metadata.date || new Date());
    const sequence = await this.getNextSequence(`meeting:${chapterCode}:${dateKey}`);
    return `MTG-${chapterCode}-${dateKey}-${this.pad(sequence, 3)}`;
  }

  async generateEventId(metadata = {}) {
    const year = this.year(metadata.date || metadata.startDate || new Date());
    const scope = String(metadata.scope || metadata.level || "national").trim().toLowerCase();

    let scopeCode;
    if (scope === "national") scopeCode = "NAT";
    else if (scope === "state") scopeCode = this.normalize(metadata.stateCode || metadata.state, "State code", { length: 2 });
    else if (scope === "chapter") scopeCode = this.compactChapterCode(metadata.chapterCode || metadata.chapterId);
    else scopeCode = this.normalize(metadata.scopeCode || scope, "Event scope", { length: 6 });

    const sequence = await this.getNextSequence(`event:${scopeCode}:${year}`);
    return `EVT-${scopeCode}-${year}-${this.pad(sequence, 3)}`;
  }

  async generateBusinessId(metadata = {}) {
    const year = this.year(metadata.date);
    const sequence = await this.getNextSequence(`business:${year}`);
    return `BUS-${year}-${this.pad(sequence, 6)}`;
  }

  async generateProductId(metadata = {}) {
    const vendorCode = this.compactVendorCode(metadata.vendorCode || metadata.vendorId);
    const sequence = await this.getNextSequence(`product:${vendorCode}`);
    return `PRD-${vendorCode}-${this.pad(sequence, 6)}`;
  }

  async generateServiceId(metadata = {}) {
    const vendorCode = this.compactVendorCode(metadata.vendorCode || metadata.vendorId);
    const sequence = await this.getNextSequence(`service:${vendorCode}`);
    return `SRV-${vendorCode}-${this.pad(sequence, 6)}`;
  }

  async generateTrainingId(metadata = {}) {
    const year = this.year(metadata.date);
    const sequence = await this.getNextSequence(`training:${year}`);
    return `TRN-${year}-${this.pad(sequence, 6)}`;
  }

  async generateCertificateId(metadata = {}) {
    const year = this.year(metadata.date);
    const sequence = await this.getNextSequence(`certificate:${year}`);
    return `CERT-${year}-${this.pad(sequence, 6)}`;
  }

  async generateInvoiceNumber(metadata = {}) {
    const year = this.year(metadata.date);
    const sequence = await this.getNextSequence(`invoice:${year}`);
    return `INV-${year}-${this.pad(sequence, 6)}`;
  }

  async generateSupportTicketId() {
    const sequence = await this.getNextSequence("support_ticket");
    return `TKT-${this.pad(sequence, 6)}`;
  }

  async generateOfficialId(metadata = {}) {
    const role = metadata.role || "";
    const rolePrefixes = {
      region_director: "RD",
      state_director: "SD",
      district_director: "DD",
      executive_director: "ED",
      launch_director: "LD",
      direct_consultant: "DC",
      chapter_president: "CP",
      vice_president: "VP",
      secretary: "SEC"
    };

    const prefix = rolePrefixes[role] || "OFF";
    let orgCode = "GLO";

    if (prefix === "RD") {
      orgCode = this.normalize(metadata.regionCode || metadata.region || "GLO", "Region Code", { length: 3 });
    } else if (prefix === "SD") {
      orgCode = this.normalize(metadata.stateCode || metadata.state || "GLO", "State Code", { length: 2 });
    } else if (["DD", "ED", "LD", "DC", "CP", "VP", "SEC"].includes(prefix)) {
      orgCode = this.normalize(metadata.districtCode || metadata.district || metadata.chapterCode || metadata.chapter || "GLO", "District/Chapter Code", { length: 3 });
    }

    const sequence = await this.getNextSequence(`official:${prefix}:${orgCode}`);
    return `${prefix}-${orgCode}-${this.pad(sequence, 4)}`;
  }

  async generateEventTicketId(metadata = {}) {
    const eventCode = this.normalize(metadata.eventCode || metadata.eventId, "Event code");
    const sequence = await this.getNextSequence(`event_ticket:${eventCode}`);
    return `TKT-${eventCode}-${this.pad(sequence, 6)}`;
  }

  async generateGenericModuleId(module, metadata = {}) {
    const prefix = GENERIC_MODULE_PREFIXES[module] || this.normalize(module, "Module prefix", { length: 3 });
    const year = this.year(metadata.date);
    const sequence = await this.getNextSequence(`generic:${module}:${year}`);
    return `${prefix}-${year}-${this.pad(sequence, 6)}`;
  }

  async generateEnterpriseRecordId(module, metadata = {}, type) {
    const normalizedType = String(type || metadata.type || metadata.level || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

    if (module === "organization") {
      if (normalizedType === "region") return this.generateRegionId(metadata);
      if (normalizedType === "state") return this.generateStateId(metadata);
      if (normalizedType === "area") return this.generateAreaId(metadata);
      if (["executive_director", "executiveDirector", "ed"].includes(normalizedType)) return this.generateExecutiveDirectorId(metadata);
      if (["launch_director", "launchDirector", "ld"].includes(normalizedType)) return this.generateLaunchDirectorId(metadata);
      if (["direct_consultant", "directConsultant", "dc"].includes(normalizedType)) return this.generateDirectConsultantId(metadata);
    }

    if (module === "chapter") return this.generateChapterId(metadata);
    if (module === "visitor") return this.generateVisitorId(metadata);
    if (module === "meeting") return this.generateMeetingId(metadata);
    if (module === "business") return this.generateBusinessId(metadata);
    if (module === "event") return this.generateEventId(metadata);
    if (module === "training") return this.generateTrainingId(metadata);

    return this.generateGenericModuleId(module, metadata);
  }

  async generateId(type, metadata = {}) {
    switch (type) {
      case "region": return this.generateRegionId(metadata);
      case "state": return this.generateStateId(metadata);
      case "area": return this.generateAreaId(metadata);
      case "executiveDirector": return this.generateExecutiveDirectorId(metadata);
      case "launchDirector": return this.generateLaunchDirectorId(metadata);
      case "directConsultant": return this.generateDirectConsultantId(metadata);
      case "chapter": return this.generateChapterId(metadata);
      case "member": return this.generateMemberId(metadata);
      case "vendor": return this.generateVendorId(metadata);
      case "visitor": return this.generateVisitorId(metadata);
      case "referral": return this.generateReferralId(metadata);
      case "meeting": return this.generateMeetingId(metadata);
      case "event": return this.generateEventId(metadata);
      case "business": return this.generateBusinessId(metadata);
      case "product": return this.generateProductId(metadata);
      case "service": return this.generateServiceId(metadata);
      case "training": return this.generateTrainingId(metadata);
      case "certificate": return this.generateCertificateId(metadata);
      default:
        throw new AppError(`Unsupported ID type "${type}"`, 400);
    }
  }
}

module.exports = new IdGeneratorService();
