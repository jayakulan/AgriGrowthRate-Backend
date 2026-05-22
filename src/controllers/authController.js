const User = require('../models/User');
const OtpVerification = require('../models/OtpVerification');
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
    const { name, email, password, role, phone, otp } = req.body;
    const normalizedEmail = email ? email.trim().toLowerCase() : '';
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered' });

    // Verify OTP
    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone number and verification OTP are required' });
    }

    // Standardize Sri Lankan phone number format to match saved database state
    let formattedPhone = phone.trim().replace(/[\s\-\+\(\)]/g, ''); 
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '94' + formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith('94') && formattedPhone.length === 9) {
      formattedPhone = '94' + formattedPhone;
    }

    const record = await OtpVerification.findOne({ phone: formattedPhone, otp });
    if (!record) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification OTP' });
    }

    // Delete OTP verification record once used
    await OtpVerification.deleteMany({ phone: formattedPhone });

    const user = await User.create({ name, email, password, role, phone: formattedPhone, isVerified: true });
    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { _id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone },
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
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
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

// @desc  Send OTP to user's phone for verification
// @route POST /api/auth/send-otp
exports.sendOtp = async (req, res, next) => {
  try {
    const { phone, email } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    // Standardize Sri Lankan phone number format (e.g. 0771234567 or +94771234567 -> 94771234567)
    let formattedPhone = phone.trim().replace(/[\s\-\+\(\)]/g, ''); // Remove spaces, symbols, plus signs
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '94' + formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith('94') && formattedPhone.length === 9) {
      formattedPhone = '94' + formattedPhone;
    }

    // Check if email already exists
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ success: false, message: 'Email already registered' });
      }
    }

    // Check if phone already exists
    const existingPhone = await User.findOne({ phone: formattedPhone });
    if (existingPhone) {
      return res.status(400).json({ success: false, message: 'Phone number already registered' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save to database (overwrite previous OTPs for same phone)
    await OtpVerification.deleteMany({ phone: formattedPhone });
    await OtpVerification.create({ phone: formattedPhone, otp });

    // Send SMS via text.lk API
    const smsUrl = process.env.TEXT_LK_API_URL;
    const smsToken = process.env.TEXT_LK_API_TOKEN;
    const senderId = process.env.TEXT_LK_SENDER_ID;

    if (!smsUrl || !smsToken || !senderId) {
      console.error('[SMS Gateway Error] SMS service environment variables are missing (TEXT_LK_API_URL, TEXT_LK_API_TOKEN, TEXT_LK_SENDER_ID).');
      return res.status(500).json({
        success: false,
        message: 'SMS Gateway is not configured inside the server environment files.'
      });
    }

    try {
      const smsResponse = await fetch(smsUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${smsToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          recipient: formattedPhone,
          sender_id: senderId,
          type: 'plain',
          message: `Your AgriGrowthRate verification OTP is ${otp}. Valid for 10 minutes.`
        })
      });

      const smsData = await smsResponse.json();
      console.log(`[SMS Gateway Response]`, smsData);

      // Check for API-specific error flags
      if (!smsResponse.ok || smsData.success === false || smsData.status === 'error') {
        const errMsg = smsData.message || `SMS gateway failed with status ${smsResponse.status}`;
        return res.status(400).json({
          success: false,
          message: `SMS Gateway Error: ${errMsg}. Please check your Sender ID and balance.`
        });
      }
    } catch (smsErr) {
      console.error('Error contacting Text.lk Gateway API:', smsErr);
      return res.status(500).json({
        success: false,
        message: 'Could not connect to SMS gateway. Please try again later.'
      });
    }

    console.log(`[SMS OTP Debug Log] Sent to ${formattedPhone}: ${otp}`);

    res.json({
      success: true,
      message: 'Verification OTP sent to your phone number'
    });
  } catch (error) {
    next(error);
  }
};
