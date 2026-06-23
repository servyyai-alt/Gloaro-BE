const Category = require("../models/Category");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse, getPagination } = require("../utils/response");

exports.createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create(req.body);
  successResponse(res, 201, "Category created", category);
});

exports.getCategories = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.parent) filter.parent = req.query.parent;
  else if (!req.query.all) filter.parent = null; // top-level by default

  const [categories, total] = await Promise.all([
    Category.find(filter).populate("subcategories").sort("order name").skip(skip).limit(limit),
    Category.countDocuments(filter),
  ]);
  paginatedResponse(res, categories, page, limit, total);
});

exports.getCategoryById = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id).populate("subcategories");
  if (!category) throw new AppError("Category not found", 404);
  successResponse(res, 200, "Category retrieved", category);
});

exports.updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!category) throw new AppError("Category not found", 404);
  successResponse(res, 200, "Category updated", category);
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError("Category not found", 404);
  const children = await Category.countDocuments({ parent: req.params.id });
  if (children > 0) throw new AppError("Cannot delete category with subcategories", 400);
  await category.deleteOne();
  successResponse(res, 200, "Category deleted");
});
