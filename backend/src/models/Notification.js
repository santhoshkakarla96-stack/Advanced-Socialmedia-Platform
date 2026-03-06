const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: {
    type: String,
    enum: ['like', 'comment', 'follow', 'mention', 'share', 'new_message', 'reply', 'system'],
    required: true,
  },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat' },
  message: String,
  isRead: { type: Boolean, default: false },
  readAt: Date,
  link: String,
  metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
