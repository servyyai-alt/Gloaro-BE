const { deleteFromCloudinary } = require("../config/cloudinary");
const logger = require("../utils/logger");

/**
 * Delete multiple Cloudinary assets safely (won't throw)
 */
const deleteAssets = async (assets = []) => {
  const promises = assets
    .filter((a) => a?.publicId)
    .map((a) =>
      deleteFromCloudinary(a.publicId).catch((err) =>
        logger.warn(`Cloudinary delete failed for ${a.publicId}: ${err.message}`)
      )
    );
  await Promise.all(promises);
};

/**
 * Extract publicId from Cloudinary URL
 */
const extractPublicId = (url) => {
  if (!url) return null;
  const parts = url.split("/");
  const filename = parts[parts.length - 1];
  const folder = parts[parts.length - 2];
  return `${folder}/${filename.split(".")[0]}`;
};

/**
 * Map uploaded files array to { url, publicId } objects
 */
const mapUploadedFiles = (files = []) => {
  return files.map((f) => ({
    url: f.path,
    publicId: f.filename,
  }));
};

module.exports = { deleteAssets, extractPublicId, mapUploadedFiles };
