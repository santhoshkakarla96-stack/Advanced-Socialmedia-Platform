const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'social-media/images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 1920, height: 1080, crop: 'limit', quality: 'auto' }],
    resource_type: 'image',
  },
});

const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'social-media/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' }],
    resource_type: 'image',
  },
});

const videoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'social-media/videos',
    allowed_formats: ['mp4', 'mov', 'avi', 'webm'],
    resource_type: 'video',
    transformation: [{ quality: 'auto' }],
  },
});

const fileSizeLimit = (maxMB) => ({
  limits: { fileSize: maxMB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = {
      image: /^image\/(jpeg|jpg|png|gif|webp)$/,
      video: /^video\/(mp4|mov|avi|webm)$/,
    };
    const type = file.mimetype.startsWith('video/') ? 'video' : 'image';
    if (allowedMimeTypes[type].test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`), false);
    }
  },
});

const uploadImage = multer({ storage: imageStorage, ...fileSizeLimit(10) });
const uploadAvatar = multer({ storage: avatarStorage, ...fileSizeLimit(5) });
const uploadVideo = multer({ storage: videoStorage, ...fileSizeLimit(100) });

const deleteFile = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return result;
  } catch (error) {
    console.error('Cloudinary deletion error:', error);
    throw error;
  }
};

module.exports = { cloudinary, uploadImage, uploadAvatar, uploadVideo, deleteFile };
