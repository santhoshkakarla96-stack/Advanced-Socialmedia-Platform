const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../src/models/User');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
});

describe('User Model', () => {
  const validUserData = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'Password123',
    displayName: 'Test User',
  };

  describe('Creation', () => {
    it('should create a user with valid data', async () => {
      const user = await User.create(validUserData);
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(user.displayName).toBe('Test User');
      expect(user.isActive).toBe(true);
      expect(user.role).toBe('user');
    });

    it('should hash the password before saving', async () => {
      const user = await User.create(validUserData);
      const userWithPassword = await User.findById(user._id).select('+password');
      expect(userWithPassword.password).not.toBe('Password123');
      expect(userWithPassword.password).toMatch(/^\$2[ab]\$\d+\$/);
    });

    it('should set displayName to username if not provided', async () => {
      const user = await User.create({ ...validUserData, displayName: undefined });
      expect(user.displayName).toBe('testuser');
    });

    it('should fail with duplicate email', async () => {
      await User.create(validUserData);
      await expect(User.create({ ...validUserData, username: 'other' })).rejects.toThrow();
    });

    it('should fail with duplicate username', async () => {
      await User.create(validUserData);
      await expect(User.create({ ...validUserData, email: 'other@test.com' })).rejects.toThrow();
    });

    it('should fail with invalid email', async () => {
      await expect(User.create({ ...validUserData, email: 'not-an-email' })).rejects.toThrow();
    });

    it('should fail with username containing special chars', async () => {
      await expect(User.create({ ...validUserData, username: 'user@name!' })).rejects.toThrow();
    });

    it('should fail with password too short', async () => {
      await expect(User.create({ ...validUserData, password: 'short' })).rejects.toThrow();
    });
  });

  describe('Methods', () => {
    let user;
    beforeEach(async () => {
      user = await User.create(validUserData);
      user = await User.findById(user._id).select('+password');
    });

    it('should return true for correct password', async () => {
      const isMatch = await user.comparePassword('Password123');
      expect(isMatch).toBe(true);
    });

    it('should return false for wrong password', async () => {
      const isMatch = await user.comparePassword('wrongpassword');
      expect(isMatch).toBe(false);
    });

    it('should generate a valid JWT access token', () => {
      const token = user.generateAccessToken();
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });

    it('should generate a valid refresh token', () => {
      const token = user.generateRefreshToken();
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('should generate password reset token', () => {
      const token = user.generatePasswordResetToken();
      expect(token).toBeTruthy();
      expect(user.passwordResetToken).toBeTruthy();
      expect(user.passwordResetExpire).toBeInstanceOf(Date);
    });

    it('should detect locked account', async () => {
      await user.updateOne({ lockUntil: Date.now() + 3600000 });
      const freshUser = await User.findById(user._id).select('+lockUntil');
      expect(freshUser.isLocked()).toBe(true);
    });

    it('should detect unlocked account', () => {
      expect(user.isLocked()).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should require username', async () => {
      await expect(User.create({ ...validUserData, username: undefined })).rejects.toThrow();
    });

    it('should require email', async () => {
      await expect(User.create({ ...validUserData, email: undefined })).rejects.toThrow();
    });

    it('should require password', async () => {
      await expect(User.create({ ...validUserData, password: undefined })).rejects.toThrow();
    });

    it('should enforce username max length', async () => {
      await expect(User.create({ ...validUserData, username: 'a'.repeat(31) })).rejects.toThrow();
    });

    it('should enforce bio max length', async () => {
      await expect(User.create({ ...validUserData, bio: 'a'.repeat(501) })).rejects.toThrow();
    });
  });
});
