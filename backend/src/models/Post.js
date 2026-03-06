const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 1000 },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  replies: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, maxlength: 500 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: {
    type: String,
    maxlength: [2000, 'Post content cannot exceed 2000 characters'],
  },
  media: [{
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    type: { type: String, enum: ['image', 'video'], required: true },
    thumbnail: String,
    width: Number,
    height: Number,
    duration: Number,
    altText: String,
  }],
  tags: [{ type: String, trim: true, lowercase: true }],
  hashtags: [{ type: String, trim: true, lowercase: true }],
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  saves: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  shares: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [commentSchema],
  visibility: {
    type: String,
    enum: ['public', 'followers', 'private'],
    default: 'public',
  },
  location: {
    name: String,
    coordinates: {
      lat: Number,
      lng: Number,
    },
  },
  isEdited: { type: Boolean, default: false },
  editHistory: [{
    content: String,
    editedAt: { type: Date, default: Date.now },
  }],
  isPinned: { type: Boolean, default: false },
  sharedPost: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  viewCount: { type: Number, default: 0 },
  reportCount: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ hashtags: 1 });
postSchema.index({ 'likes': 1 });
postSchema.index({ visibility: 1, createdAt: -1 });
postSchema.index({ content: 'text', hashtags: 'text' });

postSchema.virtual('likeCount').get(function () {
  return this.likes.length;
});

postSchema.virtual('commentCount').get(function () {
  return this.comments.length;
});

postSchema.pre('save', function (next) {
  if (this.isModified('content') && this.content) {
    const hashtagRegex = /#(\w+)/g;
    const mentionRegex = /@(\w+)/g;
    this.hashtags = [...new Set((this.content.match(hashtagRegex) || [])
      .map(tag => tag.slice(1).toLowerCase()))];
    const mentionUsernames = [...new Set((this.content.match(mentionRegex) || [])
      .map(m => m.slice(1).toLowerCase()))];
    this._mentionUsernames = mentionUsernames;
  }
  next();
});

module.exports = mongoose.model('Post', postSchema);
