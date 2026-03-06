const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, maxlength: 2000 },
  media: {
    url: String,
    publicId: String,
    type: { type: String, enum: ['image', 'video', 'file'] },
    filename: String,
    size: Number,
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'video', 'file', 'system'],
    default: 'text',
  },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  reactions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emoji: String,
  }],
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
}, { timestamps: true });

messageSchema.index({ createdAt: -1 });

const chatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  isGroup: { type: Boolean, default: false },
  groupName: { type: String, maxlength: 100 },
  groupAvatar: {
    url: String,
    publicId: String,
  },
  admin: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  lastActivity: { type: Date, default: Date.now },
  mutedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  pinnedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

chatSchema.index({ participants: 1, lastActivity: -1 });

const Message = mongoose.model('Message', messageSchema);
const Chat = mongoose.model('Chat', chatSchema);

module.exports = { Chat, Message };
