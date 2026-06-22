const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Conversation = require('../models/Conversation');

// @desc Get all conversations for a user
// @route GET /api/conversations
// @access Private
router.get('/', protect, async (req, res, next) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate('participants', 'name avatar role')
      .sort('-updatedAt');

    // Add lastMessage dynamically to mimic the old structure
    const data = conversations.map(c => {
      const conv = c.toObject();
      if (conv.messages && conv.messages.length > 0) {
        conv.lastMessage = conv.messages[conv.messages.length - 1];
      }
      return conv;
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// @desc Get messages for a conversation
// @route GET /api/conversations/:id/messages
// @access Private
router.get('/:id/messages', protect, async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const conversation = await Conversation.findById(conversationId).populate({
      path: 'messages.sender',
      select: 'name avatar'
    });
    
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    if (!conversation.participants.includes(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this conversation' });
    }

    res.json({ success: true, data: conversation.messages });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
