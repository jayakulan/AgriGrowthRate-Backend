const Chat = require('../models/Chat');
const aiService = require('../services/aiService');

// @desc  Send message to AI chatbot (RAG)
// @route POST /api/chat/message
exports.sendMessage = async (req, res, next) => {
  try {
    const { message, chatId, context } = req.body;

    // Get or create chat session
    let chat = chatId ? await Chat.findById(chatId) : null;
    if (!chat) {
      chat = await Chat.create({ user: req.user.id, context: context || 'general', messages: [] });
    }

    // Add user message
    chat.messages.push({ role: 'user', content: message });

    // Get AI response via RAG
    const aiResponse = await aiService.generateRAGResponse(message, chat.messages, context);

    // Add assistant response
    chat.messages.push({ role: 'assistant', content: aiResponse });
    if (chat.messages.length === 2) chat.title = message.substring(0, 50);
    await chat.save();

    res.json({ success: true, data: { chatId: chat._id, reply: aiResponse } });
  } catch (error) {
    next(error);
  }
};

// @desc  Get user chat history
// @route GET /api/chat/history
exports.getChatHistory = async (req, res, next) => {
  try {
    const chats = await Chat.find({ user: req.user.id }).select('title context updatedAt').sort('-updatedAt');
    res.json({ success: true, data: chats });
  } catch (error) {
    next(error);
  }
};

// @desc  Get single chat with messages
// @route GET /api/chat/:id
exports.getChat = async (req, res, next) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, user: req.user.id });
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
    res.json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};
