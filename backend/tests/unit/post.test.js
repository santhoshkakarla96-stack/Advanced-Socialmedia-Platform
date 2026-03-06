const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Post = require('../../src/models/Post');
const User = require('../../src/models/User');

let mongoServer, testUser;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.JWT_SECRET = 'test-secret';
  await mongoose.connect(mongoServer.getUri());
  testUser = await User.create({
    username: 'postauthor',
    email: 'author@test.com',
    password: 'Password123',
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Post.deleteMany({});
});

describe('Post Model', () => {
  describe('Creation', () => {
    it('should create a post with content', async () => {
      const post = await Post.create({ author: testUser._id, content: 'Hello world!' });
      expect(post.content).toBe('Hello world!');
      expect(post.author.toString()).toBe(testUser._id.toString());
      expect(post.visibility).toBe('public');
      expect(post.isDeleted).toBe(false);
      expect(post.viewCount).toBe(0);
    });

    it('should extract hashtags from content', async () => {
      const post = await Post.create({
        author: testUser._id,
        content: 'Check out #javascript and #nodejs today!',
      });
      expect(post.hashtags).toContain('javascript');
      expect(post.hashtags).toContain('nodejs');
    });

    it('should deduplicate hashtags', async () => {
      const post = await Post.create({
        author: testUser._id,
        content: '#test and #test again #TEST',
      });
      expect(post.hashtags.filter(t => t === 'test').length).toBe(1);
    });

    it('should allow post with media only (no text)', async () => {
      const post = await Post.create({
        author: testUser._id,
        media: [{ url: 'https://example.com/img.jpg', publicId: 'abc123', type: 'image' }],
      });
      expect(post._id).toBeTruthy();
    });

    it('should set correct visibility', async () => {
      const post = await Post.create({
        author: testUser._id,
        content: 'Private post',
        visibility: 'private',
      });
      expect(post.visibility).toBe('private');
    });

    it('should fail with invalid visibility', async () => {
      await expect(Post.create({
        author: testUser._id,
        content: 'Test',
        visibility: 'invalid',
      })).rejects.toThrow();
    });

    it('should fail if content exceeds max length', async () => {
      await expect(Post.create({
        author: testUser._id,
        content: 'a'.repeat(2001),
      })).rejects.toThrow();
    });
  });

  describe('Virtuals', () => {
    it('should calculate likeCount virtual', async () => {
      const post = await Post.create({
        author: testUser._id,
        content: 'Test',
        likes: [testUser._id, new mongoose.Types.ObjectId()],
      });
      expect(post.likeCount).toBe(2);
    });

    it('should calculate commentCount virtual', async () => {
      const post = await Post.create({ author: testUser._id, content: 'Test' });
      post.comments.push({ user: testUser._id, content: 'Nice post!' });
      post.comments.push({ user: testUser._id, content: 'Great!' });
      await post.save();
      expect(post.commentCount).toBe(2);
    });
  });

  describe('Soft Delete', () => {
    it('should mark post as deleted without removing from DB', async () => {
      const post = await Post.create({ author: testUser._id, content: 'Delete me' });
      await Post.findByIdAndUpdate(post._id, { isDeleted: true });
      const found = await Post.findById(post._id);
      expect(found).toBeTruthy();
      expect(found.isDeleted).toBe(true);
    });
  });
});
