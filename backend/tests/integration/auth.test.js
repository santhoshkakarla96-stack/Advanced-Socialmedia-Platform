const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Must set env before requiring app
process.env.JWT_SECRET = 'integration-test-secret';
process.env.JWT_REFRESH_SECRET = 'integration-refresh-secret';
process.env.NODE_ENV = 'test';

const app = require('../../src/app');
const User = require('../../src/models/User');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
});

const testUser = {
  username: 'integrationuser',
  email: 'integration@test.com',
  password: 'Password123',
  displayName: 'Integration User',
};

describe('Auth API Integration Tests', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeTruthy();
      expect(res.body.refreshToken).toBeTruthy();
      expect(res.body.user.username).toBe('integrationuser');
      expect(res.body.user.password).toBeUndefined();
    });

    it('should reject duplicate email', async () => {
      await request(app).post('/api/auth/register').send(testUser);
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, username: 'different' })
        .expect(400);
      expect(res.body.error).toMatch(/already/i);
    });

    it('should reject duplicate username', async () => {
      await request(app).post('/api/auth/register').send(testUser);
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, email: 'other@test.com' })
        .expect(400);
      expect(res.body.error).toMatch(/already/i);
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, email: 'notanemail' })
        .expect(400);
      expect(res.body.error).toBeTruthy();
    });

    it('should reject weak password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, password: 'weak' })
        .expect(400);
      expect(res.body.error).toBeTruthy();
    });

    it('should reject username with special chars', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, username: 'user@name!' })
        .expect(400);
      expect(res.body.error).toBeTruthy();
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(testUser);
    });

    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeTruthy();
      expect(res.body.user.email).toBe(testUser.email);
    });

    it('should reject wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'wrongpass' })
        .expect(401);
      expect(res.body.error).toMatch(/invalid/i);
    });

    it('should reject non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@test.com', password: testUser.password })
        .expect(401);
      expect(res.body.error).toMatch(/invalid/i);
    });
  });

  describe('GET /api/auth/me', () => {
    let accessToken;

    beforeEach(async () => {
      const res = await request(app).post('/api/auth/register').send(testUser);
      accessToken = res.body.accessToken;
    });

    it('should return current user with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.user.password).toBeUndefined();
    });

    it('should return 401 without token', async () => {
      await request(app).get('/api/auth/me').expect(401);
    });

    it('should return 401 with invalid token', async () => {
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should issue new tokens with valid refresh token', async () => {
      const regRes = await request(app).post('/api/auth/register').send(testUser);
      const { refreshToken } = regRes.body;

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.accessToken).toBeTruthy();
      expect(res.body.refreshToken).toBeTruthy();
    });

    it('should reject invalid refresh token', async () => {
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });
  });

  describe('GET /api/health', () => {
    it('should return 200 OK', async () => {
      const res = await request(app).get('/api/health').expect(200);
      expect(res.body.status).toBe('OK');
    });
  });
});
