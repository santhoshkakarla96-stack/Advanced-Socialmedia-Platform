const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'posts-test-secret';
process.env.JWT_REFRESH_SECRET = 'posts-refresh-secret';
process.env.NODE_ENV = 'test';

// Mock socket.io to avoid real-time dependency in tests
jest.mock('../../src/socket/socketManager', () => ({
  getIO: () => ({ to: () => ({ emit: jest.fn() }) }),
  isUserOnline: () => false,
}));

// Mock cloudinary uploads
jest.mock('../../src/config/cloudinary', () => ({
  uploadImage: {
    array: () => (req, res, next) => next(),
    single: () => (req, res, next) => next(),
  },
  uploadAvatar: { single: () => (req, res, next) => next() },
  uploadVideo: { single: () => (req, res, next) => next() },
  deleteFile: jest.fn().mockResolvedValue({ result: 'ok' }),
}));

const app = require('../../src/app');
const User = require('../../src/models/User');
const Post = require('../../src/models/Post');

let mongoServer, accessToken, userId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Post.deleteMany({});

  const res = await request(app)
    .post('/api/auth/register')
    .send({ username: 'postuser', email: 'post@test.com', password: 'Password123' });
  accessToken = res.body.accessToken;
  userId = res.body.user._id;
});

describe('Posts API Integration Tests', () => {
  describe('POST /api/posts', () => {
    it('should create a post with text content', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: 'My first post!' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.post.content).toBe('My first post!');
      expect(res.body.post.author.username).toBe('postuser');
    });

    it('should reject post with no content and no media', async () => {
      await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app).post('/api/posts').send({ content: 'Test' }).expect(401);
    });

    it('should extract hashtags from content', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: 'Post about #nodejs and #react' })
        .expect(201);

      expect(res.body.post.hashtags).toContain('nodejs');
      expect(res.body.post.hashtags).toContain('react');
    });
  });

  describe('GET /api/posts/feed', () => {
    it('should return empty feed for new user', async () => {
      const res = await request(app)
        .get('/api/posts/feed')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.posts).toBeDefined();
      expect(Array.isArray(res.body.posts)).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app).get('/api/posts/feed').expect(401);
    });
  });

  describe('PUT /api/posts/:id/like', () => {
    let postId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: 'Like this post' });
      postId = res.body.post._id;
    });

    it('should like a post', async () => {
      const res = await request(app)
        .put(`/api/posts/${postId}/like`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.liked).toBe(true);
      expect(res.body.likeCount).toBe(1);
    });

    it('should unlike a post when liked again', async () => {
      await request(app).put(`/api/posts/${postId}/like`).set('Authorization', `Bearer ${accessToken}`);

      const res = await request(app)
        .put(`/api/posts/${postId}/like`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.liked).toBe(false);
      expect(res.body.likeCount).toBe(0);
    });

    it('should return 404 for non-existent post', async () => {
      await request(app)
        .put(`/api/posts/${new mongoose.Types.ObjectId()}/like`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('POST /api/posts/:id/comments', () => {
    let postId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: 'Comment on this' });
      postId = res.body.post._id;
    });

    it('should add a comment', async () => {
      const res = await request(app)
        .post(`/api/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: 'Great post!' })
        .expect(201);

      expect(res.body.comment.content).toBe('Great post!');
    });

    it('should reject empty comment', async () => {
      await request(app)
        .post(`/api/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: '' })
        .expect(400);
    });
  });

  describe('DELETE /api/posts/:id', () => {
    it('should soft-delete own post', async () => {
      const createRes = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: 'Delete me' });

      await request(app)
        .delete(`/api/posts/${createRes.body.post._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const post = await Post.findById(createRes.body.post._id);
      expect(post.isDeleted).toBe(true);
    });

    it('should not allow deleting others\' posts', async () => {
      const otherUser = await request(app)
        .post('/api/auth/register')
        .send({ username: 'other', email: 'other@test.com', password: 'Password123' });

      const otherPost = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${otherUser.body.accessToken}`)
        .send({ content: 'Other user post' });

      await request(app)
        .delete(`/api/posts/${otherPost.body.post._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });
  });
});
