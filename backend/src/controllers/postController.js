const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { deleteFile } = require('../config/cloudinary');
const { getIO } = require('../socket/socketManager');

exports.createPost = async (req, res, next) => {
  try {
    const { content, visibility, location } = req.body;

    if (!content && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ error: 'Post must have content or media' });
    }

    const media = (req.files || []).map(file => ({
      url: file.path,
      publicId: file.filename,
      type: file.mimetype.startsWith('video/') ? 'video' : 'image',
    }));

    const post = await Post.create({
      author: req.user._id,
      content,
      media,
      visibility: visibility || 'public',
      location: location ? JSON.parse(location) : undefined,
    });

    await post.populate('author', 'username displayName avatar');


    if (post._mentionUsernames?.length > 0) {
      const mentionedUsers = await User.find({ username: { $in: post._mentionUsernames } });
      const io = getIO();

      for (const mentionedUser of mentionedUsers) {
        if (mentionedUser._id.toString() !== req.user._id.toString()) {
          const notification = await Notification.create({
            recipient: mentionedUser._id,
            sender: req.user._id,
            type: 'mention',
            post: post._id,
            message: `${req.user.displayName} mentioned you in a post`,
          });

          io.to(`user-${mentionedUser._id}`).emit('notification', {
            type: 'mention',
            notification,
          });
        }
      }
    }

    res.status(201).json({ success: true, post });
  } catch (error) {
    next(error);
  }
};

exports.getFeed = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;

    const following = req.user.following;
    const authorIds = [...following, req.user._id];

    const posts = await Post.find({
      author: { $in: authorIds },
      visibility: { $in: ['public', 'followers'] },
      isDeleted: false,
    })
      .populate('author', 'username displayName avatar isVerified')
      .populate('comments.user', 'username displayName avatar')
      .populate('sharedPost')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Post.countDocuments({
      author: { $in: authorIds },
      visibility: { $in: ['public', 'followers'] },
      isDeleted: false,
    });

    res.json({
      success: true,
      posts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

exports.getPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username displayName avatar isVerified')
      .populate('comments.user', 'username displayName avatar')
      .populate('comments.replies.user', 'username displayName avatar');

    if (!post || post.isDeleted) {
      return res.status(404).json({ error: 'Post not found' });
    }


    await Post.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });

    res.json({ success: true, post });
  } catch (error) {
    next(error);
  }
};

exports.likePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', '_id username displayName');

    if (!post || post.isDeleted) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const userId = req.user._id;
    const isLiked = post.likes.includes(userId);

    if (isLiked) {
      post.likes.pull(userId);
    } else {
      post.likes.push(userId);


      if (post.author._id.toString() !== userId.toString()) {
        const notification = await Notification.create({
          recipient: post.author._id,
          sender: userId,
          type: 'like',
          post: post._id,
          message: `${req.user.displayName} liked your post`,
        });

        getIO().to(`user-${post.author._id}`).emit('notification', { notification });
      }
    }

    await post.save();
    res.json({ success: true, liked: !isLiked, likeCount: post.likes.length });
  } catch (error) {
    next(error);
  }
};

exports.addComment = async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const post = await Post.findById(req.params.id).populate('author', '_id');
    if (!post || post.isDeleted) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const comment = { user: req.user._id, content: content.trim() };
    post.comments.push(comment);
    await post.save();

    await post.populate('comments.user', 'username displayName avatar');
    const newComment = post.comments[post.comments.length - 1];


    if (post.author._id.toString() !== req.user._id.toString()) {
      const notification = await Notification.create({
        recipient: post.author._id,
        sender: req.user._id,
        type: 'comment',
        post: post._id,
        message: `${req.user.displayName} commented on your post`,
      });

      getIO().to(`user-${post.author._id}`).emit('notification', { notification });
    }

    res.status(201).json({ success: true, comment: newComment });
  } catch (error) {
    next(error);
  }
};

exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.isDeleted) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }


    for (const media of post.media) {
      await deleteFile(media.publicId, media.type).catch(console.error);
    }

    await Post.findByIdAndUpdate(req.params.id, { isDeleted: true });
    res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    next(error);
  }
};

exports.searchPosts = async (req, res, next) => {
  try {
    const { q, hashtag, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = { isDeleted: false, visibility: 'public' };

    if (q) {
      query.$text = { $search: q };
    } else if (hashtag) {
      query.hashtags = hashtag.toLowerCase().replace('#', '');
    }

    const posts = await Post.find(query)
      .populate('author', 'username displayName avatar isVerified')
      .sort(q ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ success: true, posts });
  } catch (error) {
    next(error);
  }
};
