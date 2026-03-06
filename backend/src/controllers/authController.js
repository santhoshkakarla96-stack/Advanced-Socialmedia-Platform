const { validationResult } = require('express-validator');
const crypto = require('crypto');
const User = require('../models/User');

const sendTokenResponse = (user, statusCode, res) => {
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  const userResponse = {
    _id: user._id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatar: user.avatar,
    role: user.role,
    isVerified: user.isVerified,
    followerCount: user.followers?.length || 0,
    followingCount: user.following?.length || 0,
    preferences: user.preferences,
  };

  res.status(statusCode).json({
    success: true,
    accessToken,
    refreshToken,
    user: userResponse,
  });
};

exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { username, email, password, displayName } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({
        error: existingUser.email === email ? 'Email already registered' : 'Username already taken',
      });
    }

    const user = await User.create({ username, email, password, displayName });
    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.isLocked()) {
      const lockTime = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        error: `Account locked. Try again in ${lockTime} minutes.`,
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incrementLoginAttempts();
      return res.status(401).json({ error: 'Invalid credentials' });
    }


    if (user.loginAttempts > 0) {
      await user.updateOne({ $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } });
    }

    await user.updateOne({ lastSeen: new Date() });
    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const accessToken = user.generateAccessToken();
    const newRefreshToken = user.generateRefreshToken();

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('followers', 'username displayName avatar')
      .populate('following', 'username displayName avatar');
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
  res.json({ success: true, message: 'Logged out successfully' });
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({ error: 'No user with that email' });
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });


    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    res.json({
      success: true,
      message: 'Password reset link sent to email',

      ...(process.env.NODE_ENV === 'development' && { resetUrl }),
    });
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpire = undefined;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};
