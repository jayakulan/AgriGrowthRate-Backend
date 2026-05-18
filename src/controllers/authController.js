const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '15m',
  });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
  return { accessToken, refreshToken };
};

// @desc  Register a new user
// @route POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered' });

    const user = await User.create({ name, email, password, role });
    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { _id: user._id, name: user.name, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

// @desc  Login user
// @route POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      success: true,
      message: 'Login successful',
      data: { _id: user._id, name: user.name, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

// @desc  Logout
// @route POST /api/auth/logout
exports.logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { refreshToken: '' });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc  Get current logged-in user
// @route GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password -refreshToken');
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc  Google Login / Register
// @route POST /api/auth/google
exports.googleLogin = async (req, res, next) => {
  try {
    const { credential, accessToken } = req.body;
    if (!credential && !accessToken) {
      return res.status(400).json({ success: false, message: 'Google credential or access token is required' });
    }

    let email, name, picture;

    if (credential) {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
    } else {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch user info from Google');
      }
      const data = await response.json();
      email = data.email;
      name = data.name;
      picture = data.picture;
    }

    // Check if user already exists
    let user = await User.findOne({ email });

    if (user) {
      // User exists, login
      const { accessToken: jwtAccess, refreshToken } = generateTokens(user._id);
      user.refreshToken = refreshToken;
      if (picture && !user.avatar) {
        user.avatar = picture;
      }
      await user.save();

      return res.json({
        success: true,
        message: 'Google login successful',
        data: { _id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
        accessToken: jwtAccess,
        refreshToken,
      });
    } else {
      // Create new user (register)
      const generatedPassword = Math.random().toString(36).slice(-10) + 'A1!';
      
      user = await User.create({
        name,
        email,
        password: generatedPassword,
        avatar: picture || '',
        isVerified: true,
        role: 'consumer',
      });

      const { accessToken: jwtAccess, refreshToken } = generateTokens(user._id);
      user.refreshToken = refreshToken;
      await user.save();

      return res.status(201).json({
        success: true,
        message: 'Google registration successful',
        data: { _id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
        accessToken: jwtAccess,
        refreshToken,
      });
    }
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(401).json({ success: false, message: 'Google authentication failed', error: error.message });
  }
};
