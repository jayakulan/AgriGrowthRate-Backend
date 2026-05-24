const express = require('express');
const router = express.Router();
const { register, login, logout, getMe, googleLogin, sendOtp, refresh } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/send-otp', sendOtp);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/logout', protect, logout);
router.post('/refresh', refresh);
router.get('/me', protect, getMe);

module.exports = router;
