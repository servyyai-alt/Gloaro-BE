const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const createCloudinaryStorage = (folder, allowedFormats = ["jpg", "jpeg", "png", "webp"]) => {
  return new CloudinaryStorage({
    cloudinary,
    params: {
      folder: `vendor-directory/${folder}`,
      allowed_formats: allowedFormats,
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    },
  });
};

const uploadSingle = (fieldName, folder) => {
  const storage = createCloudinaryStorage(folder);
  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith("image/")) cb(null, true);
      else cb(new Error("Only image files are allowed"), false);
    },
  }).single(fieldName);
};

const uploadMultiple = (fieldName, folder, maxCount = 10) => {
  const storage = createCloudinaryStorage(folder);
  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith("image/")) cb(null, true);
      else cb(new Error("Only image files are allowed"), false);
    },
  }).array(fieldName, maxCount);
};

const uploadFields = (fields, folder) => {
  const storage = createCloudinaryStorage(folder);
  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith("image/")) cb(null, true);
      else cb(new Error("Only image files are allowed"), false);
    },
  }).fields(fields);
};

const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    throw new Error(`Cloudinary delete failed: ${error.message}`);
  }
};

const uploadToCloudinary = async (filePath, folder, options = {}) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `vendor-directory/${folder}`,
      ...options,
    });
    return result;
  } catch (error) {
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

module.exports = {
  cloudinary,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  deleteFromCloudinary,
  uploadToCloudinary,
};
