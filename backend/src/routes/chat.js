const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { Chat, Message } = require('../models/Chat');
const { uploadImage } = require('../config/cloudinary');

router.get('/', protect, async (req, res, next) => {
  try {
    const chats = await Chat.find({
      participants: req.user._id,
      isActive: true,
    })
      .populate('participants', 'username displayName avatar lastSeen')
      .populate('lastMessage')
      .sort({ lastActivity: -1 });

    res.json({ success: true, chats });
  } catch (error) {
    next(error);
  }
});

router.post('/direct', protect, async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Target user ID required' });

    let chat = await Chat.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, userId], $size: 2 },
    }).populate('participants', 'username displayName avatar lastSeen');

    if (!chat) {
      chat = await Chat.create({
        participants: [req.user._id, userId],
        isGroup: false,
      });
      await chat.populate('participants', 'username displayName avatar lastSeen');
    }

    res.json({ success: true, chat });
  } catch (error) {
    next(error);
  }
});

router.post('/group', protect, async (req, res, next) => {
  try {
    const { participants, groupName } = req.body;
    if (!participants || participants.length < 2) {
      return res.status(400).json({ error: 'Group chat needs at least 2 other participants' });
    }

    const allParticipants = [...new Set([req.user._id.toString(), ...participants])];

    const chat = await Chat.create({
      participants: allParticipants,
      isGroup: true,
      groupName: groupName || `Group (${allParticipants.length})`,
      admin: [req.user._id],
    });

    await chat.populate('participants', 'username displayName avatar');
    res.status(201).json({ success: true, chat });
  } catch (error) {
    next(error);
  }
});

router.get('/:chatId/messages', protect, async (req, res, next) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.chatId, participants: req.user._id });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);

    const messages = await Message.find({ _id: { $in: [] } })
      .populate('sender', 'username displayName avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);


    res.json({ success: true, messages: messages.reverse(), chatId: req.params.chatId });
  } catch (error) {
    next(error);
  }
});

router.post('/:chatId/messages', protect, uploadImage.single('media'), async (req, res, next) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.chatId, participants: req.user._id });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    const { content, messageType = 'text' } = req.body;
    const mediaData = req.file ? {
      url: req.file.path,
      publicId: req.file.filename,
      type: req.file.mimetype.startsWith('video/') ? 'video' : 'image',
    } : undefined;

    const message = await Message.create({
      sender: req.user._id,
      content,
      messageType: mediaData ? (mediaData.type === 'video' ? 'video' : 'image') : messageType,
      media: mediaData,
      readBy: [req.user._id],
    });

    await message.populate('sender', 'username displayName avatar');


    const { getIO } = require('../socket/socketManager');
    getIO().to(`chat-${req.params.chatId}`).emit('new-message', {
      chatId: req.params.chatId,
      message,
    });

    res.status(201).json({ success: true, message });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
