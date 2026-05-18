const express = require('express');
const router = express.Router();
const { register, login, logout, getMe, googleLogin } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

module.exports = router;
