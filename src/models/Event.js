const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    eventId: { type: String, unique: true, sparse: true, trim: true, uppercase: true, immutable: true, index: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true },
    description: { type: String, required: true },
    shortDescription: String,
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    coverImage: { url: String, publicId: String },
    gallery: [{ url: String, publicId: String }],
    type: { type: String, enum: ["online", "offline", "hybrid"], default: "offline" },
    venue: { name: String, address: String, city: String, state: String, mapLink: String },
    onlineLink: String,
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    timezone: { type: String, default: "Asia/Kolkata" },
    registration: {
      isRequired: { type: Boolean, default: true },
      isFree: { type: Boolean, default: true },
      price: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
      maxAttendees: Number,
      registrationDeadline: Date,
      allowGuests: { type: Boolean, default: false },
      maxGuestsPerRegistration: { type: Number, default: 1 },
    },
    status: { type: String, enum: ["draft", "published", "cancelled", "completed"], default: "draft" },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    tags: [String],
    attendees: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        registeredAt: { type: Date, default: Date.now },
        status: { type: String, enum: ["registered", "attended", "cancelled", "no_show"], default: "registered" },
        payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
        ticketNumber: String,
        guestCount: { type: Number, default: 0 },
      },
    ],
    stats: {
      totalRegistrations: { type: Number, default: 0 },
      totalAttended: { type: Number, default: 0 },
      totalViews: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

eventSchema.index({ startDate: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ title: "text", description: "text" });
eventSchema.index({ eventId: 1 }, { unique: true, sparse: true });

const slugify = require("slugify");
eventSchema.pre("save", async function (next) {
  if (this.isModified("title")) {
    let slug = slugify(this.title, { lower: true, strict: true });
    const existing = await mongoose.model("Event").findOne({ slug, _id: { $ne: this._id } });
    if (existing) slug = `${slug}-${Date.now()}`;
    this.slug = slug;
  }
  next();
});

module.exports = mongoose.model("Event", eventSchema);
