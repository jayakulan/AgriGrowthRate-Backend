const express = require('express');
const router = express.Router();
const { sendMessage, getChatHistory, getChat } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.post('/message', protect, sendMessage);
router.get('/history', protect, getChatHistory);
router.get('/:id', protect, getChat);

module.exports = router;
