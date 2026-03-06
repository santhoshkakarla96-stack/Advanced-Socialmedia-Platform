const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadAvatar } = require('../config/cloudinary');
const User = require('../models/User');
const Post = require('../models/Post');

router.get('/:username', async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('-password -refreshToken -emailVerificationToken -passwordResetToken');

    if (!user || !user.isActive) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

router.get('/:username/posts', async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);

    const posts = await Post.find({ author: user._id, isDeleted: false, visibility: 'public' })
      .populate('author', 'username displayName avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ success: true, posts });
  } catch (error) {
    next(error);
  }
});

router.post('/:userId/follow', protect, async (req, res, next) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const currentUserId = req.user._id;
    if (targetUser._id.toString() === currentUserId.toString()) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const isFollowing = targetUser.followers.includes(currentUserId);

    if (isFollowing) {
      await User.findByIdAndUpdate(targetUser._id, { $pull: { followers: currentUserId } });
      await User.findByIdAndUpdate(currentUserId, { $pull: { following: targetUser._id } });
    } else {
      await User.findByIdAndUpdate(targetUser._id, { $addToSet: { followers: currentUserId } });
      await User.findByIdAndUpdate(currentUserId, { $addToSet: { following: targetUser._id } });

      const { getIO } = require('../socket/socketManager');
      const Notification = require('../models/Notification');

      const notification = await Notification.create({
        recipient: targetUser._id,
        sender: currentUserId,
        type: 'follow',
        message: `${req.user.displayName} started following you`,
      });

      getIO().to(`user-${targetUser._id}`).emit('notification', { notification });
    }

    res.json({
      success: true,
      following: !isFollowing,
      followerCount: isFollowing ? targetUser.followers.length - 1 : targetUser.followers.length + 1,
    });
  } catch (error) {
    next(error);
  }
});

router.put('/me/profile', protect, uploadAvatar.single('avatar'), async (req, res, next) => {
  try {
    const { displayName, bio, location, website } = req.body;
    const updates = {};

    if (displayName) updates.displayName = displayName;
    if (bio !== undefined) updates.bio = bio;
    if (location !== undefined) updates.location = location;
    if (website !== undefined) updates.website = website;

    if (req.file) {
      updates.avatar = { url: req.file.path, publicId: req.file.filename };
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

router.get('/search/users', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ success: true, users: [] });

    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { displayName: { $regex: q, $options: 'i' } },
      ],
      isActive: true,
    }).select('username displayName avatar isVerified').limit(10);

    res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
