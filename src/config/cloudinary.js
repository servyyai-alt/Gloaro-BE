const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
const { AppError } = require("../middleware/errorHandler");

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

const createDocumentCloudinaryStorage = (folder) => {
  return new CloudinaryStorage({
    cloudinary,
    params: {
      folder: `vendor-directory/${folder}`,
      resource_type: "auto",
      allowed_formats: ["jpg", "jpeg", "png", "webp", "pdf"],
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

const uploadDocumentFields = (fields, folder) => {
  const storage = createDocumentCloudinaryStorage(folder);
  return multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = file.mimetype.startsWith("image/") || file.mimetype === "application/pdf";
      if (allowed) cb(null, true);
      else cb(new Error("Only image and PDF documents are allowed"), false);
    },
  }).fields(fields);
};

const uploadDocumentMemoryFields = (fields) => {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = file.mimetype.startsWith("image/") || file.mimetype === "application/pdf";
      if (allowed) cb(null, true);
      else cb(new Error("Only image and PDF documents are allowed"), false);
    },
  }).fields(fields);
};

const hasCloudinaryCredentials = () => {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
};

const isCloudinaryCredentialError = (error) => {
  const message = error?.message || "";
  return /invalid api_key|must supply api_key|unknown api key|api secret/i.test(message);
};

const handleCloudinaryUpload = (uploadMiddleware) => (req, res, next) => {
  if (!hasCloudinaryCredentials()) {
    return next(new AppError("Cloudinary upload is not configured. Please set Cloudinary credentials.", 503));
  }

  uploadMiddleware(req, res, (error) => {
    if (!error) return next();

    if (isCloudinaryCredentialError(error)) {
      return next(new AppError("Cloudinary credentials are invalid. Please verify Cloudinary configuration.", 503));
    }

    return next(error);
  });
};

const uploadBufferToCloudinary = (file, folder) => {
  const isPdf = file.mimetype === "application/pdf";

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `vendor-directory/${folder}`,
        resource_type: isPdf ? "raw" : "image",
        use_filename: true,
        unique_filename: true,
        timeout: 120000,
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );

    uploadStream.end(file.buffer);
  });
};

const uploadMemoryDocumentsToCloudinary = (folder) => async (req, res, next) => {
  if (!hasCloudinaryCredentials()) {
    return next(new AppError("Cloudinary upload is not configured. Please set Cloudinary credentials.", 503));
  }

  try {
    const files = req.files || {};
    const entries = Object.entries(files).flatMap(([field, items]) => items.map((file) => ({ field, file })));

    await Promise.all(
      entries.map(async ({ field, file }) => {
        const result = await uploadBufferToCloudinary(file, folder);
        file.path = result.secure_url || result.url;
        file.filename = result.public_id;
        file.fieldname = field;
        file.resourceType = result.resource_type;
      })
    );

    return next();
  } catch (error) {
    if (isCloudinaryCredentialError(error)) {
      return next(new AppError("Cloudinary credentials are invalid. Please verify Cloudinary configuration.", 503));
    }

    if (/timeout|timed out|request timeout/i.test(error?.message || "")) {
      return next(new AppError("Cloudinary upload timed out. Please try again with smaller files or check network access.", 504));
    }

    return next(new AppError(`Cloudinary upload failed: ${error.message || "Unknown upload error"}`, 502));
  }
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
  uploadDocumentFields,
  uploadDocumentMemoryFields,
  handleCloudinaryUpload,
  uploadMemoryDocumentsToCloudinary,
  deleteFromCloudinary,
  uploadToCloudinary,
};
