const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const { uploadImage } = require('../config/cloudinary');
const {
  createPost, getFeed, getPost, likePost, addComment, deletePost, searchPosts
} = require('../controllers/postController');

router.get('/feed', protect, getFeed);
router.get('/search', optionalAuth, searchPosts);
router.post('/', protect, uploadImage.array('media', 10), createPost);
router.get('/:id', optionalAuth, getPost);
router.put('/:id/like', protect, likePost);
router.post('/:id/comments', protect, addComment);
router.delete('/:id', protect, deletePost);

module.exports = router;
