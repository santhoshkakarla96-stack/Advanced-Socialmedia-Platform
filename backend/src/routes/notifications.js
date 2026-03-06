const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Notification = require('../models/Notification');

router.get('/', protect, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('sender', 'username displayName avatar')
      .populate('post', 'content media')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    next(error);
  }
});

router.put('/read', protect, async (req, res, next) => {
  try {
    const { notificationIds } = req.body;
    const query = { recipient: req.user._id };
    if (notificationIds?.length) query._id = { $in: notificationIds };

    await Notification.updateMany(query, { isRead: true, readAt: new Date() });
    res.json({ success: true, message: 'Notifications marked as read' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', protect, async (req, res, next) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
