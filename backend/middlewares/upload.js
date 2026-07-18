const multer = require("multer");
const cloudinaryStorage = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary");

// Configure cloudinary v2 (the library internally accesses cloudinary.v2)
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "demo",
  api_key: process.env.CLOUDINARY_API_KEY || "demo",
  api_secret: process.env.CLOUDINARY_API_SECRET || "demo",
});

// The multer-storage-cloudinary module exports a factory function,
// and internally accesses cloudinary.v2.uploader — so we pass the
// root cloudinary module, NOT cloudinary.v2.
const storage = cloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "foodbridge_donations",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG and WebP images are allowed"), false);
    }
  },
});

module.exports = upload;

