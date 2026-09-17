const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { findById, find } = require('../utils/dbHelpers');

// @desc Get all conversations for a user
// @route GET /api/conversations
// @access Private
router.get('/', protect, async (req, res, next) => {
  try {
    const allConvs = await find(Conversation);
    const userConvs = allConvs.filter(c => c.participants && c.participants.includes(req.user.id));

    const data = await Promise.all(
      userConvs.map(async (c) => {
        const participants = await Promise.all(
          (c.participants || []).map(async (pId) => {
            const user = await findById(User, pId);
            return user ? { id: user.id, name: user.name, avatar: user.avatar, role: user.role } : null;
          })
        );
        
        const lastMessage = c.messages && c.messages.length > 0 
          ? c.messages[c.messages.length - 1] 
          : null;

        return {
          ...c,
          participants: participants.filter(Boolean),
          lastMessage
        };
      })
    );

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
    const conversation = await findById(Conversation, req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    if (!conversation.participants || !conversation.participants.includes(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this conversation' });
    }

    const messages = await Promise.all(
      (conversation.messages || []).map(async (m) => {
        const sender = await findById(User, m.sender);
        return {
          ...m,
          sender: sender ? { id: sender.id, name: sender.name, avatar: sender.avatar } : null
        };
      })
    );

    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
