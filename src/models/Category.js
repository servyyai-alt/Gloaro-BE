const mongoose = require("mongoose");
const slugify = require("slugify");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Category name is required"], trim: true },
    slug: { type: String, unique: true },
    type: { type: String, enum: ["business", "product", "service"], required: true },
    description: String,
    icon: String,
    image: { url: String, publicId: String },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    meta: {
      title: String,
      description: String,
      keywords: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

categorySchema.index({ slug: 1 });
categorySchema.index({ type: 1 });
categorySchema.index({ parent: 1 });
categorySchema.virtual("subcategories", {
  ref: "Category",
  localField: "_id",
  foreignField: "parent",
});

categorySchema.pre("save", async function (next) {
  if (this.isModified("name")) {
    let slug = slugify(this.name, { lower: true, strict: true });
    const existing = await mongoose.model("Category").findOne({ slug, _id: { $ne: this._id } });
    if (existing) slug = `${slug}-${this.type}`;
    this.slug = slug;
  }
  next();
});

module.exports = mongoose.model("Category", categorySchema);
