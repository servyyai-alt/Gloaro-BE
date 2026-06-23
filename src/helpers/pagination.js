/**
 * Build a Mongoose query filter from common query params
 */
const buildFilter = (query, allowedFields = []) => {
  const filter = {};
  allowedFields.forEach((field) => {
    if (query[field] !== undefined && query[field] !== "") {
      filter[field] = query[field];
    }
  });
  return filter;
};

/**
 * Build sort object from sortBy query param
 * e.g. sortBy=createdAt:desc,name:asc
 */
const buildSort = (sortBy = "-createdAt") => {
  if (sortBy.includes(":")) {
    const parts = sortBy.split(",");
    const sort = {};
    parts.forEach((p) => {
      const [field, dir] = p.split(":");
      sort[field] = dir === "desc" ? -1 : 1;
    });
    return sort;
  }
  return sortBy;
};

/**
 * Build date range filter
 */
const buildDateFilter = (from, to, field = "createdAt") => {
  const filter = {};
  if (from || to) {
    filter[field] = {};
    if (from) filter[field].$gte = new Date(from);
    if (to) filter[field].$lte = new Date(to);
  }
  return filter;
};

/**
 * Build text search filter
 */
const buildSearchFilter = (search, fields = []) => {
  if (!search) return {};
  if (fields.length === 0) return { $text: { $search: search } };
  return {
    $or: fields.map((f) => ({ [f]: { $regex: search, $options: "i" } })),
  };
};

module.exports = { buildFilter, buildSort, buildDateFilter, buildSearchFilter };
