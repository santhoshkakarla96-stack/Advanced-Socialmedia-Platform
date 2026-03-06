const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadImage, uploadVideo, uploadAvatar, deleteFile } = require('../config/cloudinary');

router.post('/image', protect, uploadImage.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  res.json({
    success: true,
    url: req.file.path,
    publicId: req.file.filename,
    type: 'image',
  });
});

router.post('/images', protect, uploadImage.array('images', 10), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'No images uploaded' });
  const files = req.files.map(file => ({
    url: file.path,
    publicId: file.filename,
    type: 'image',
  }));
  res.json({ success: true, files });
});

router.post('/avatar', protect, uploadAvatar.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  res.json({
    success: true,
    url: req.file.path,
    publicId: req.file.filename,
  });
});

router.post('/video', protect, uploadVideo.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No video uploaded' });
  res.json({
    success: true,
    url: req.file.path,
    publicId: req.file.filename,
    type: 'video',
  });
});

router.delete('/:publicId', protect, async (req, res, next) => {
  try {
    const { resourceType = 'image' } = req.query;
    await deleteFile(req.params.publicId, resourceType);
    res.json({ success: true, message: 'File deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
