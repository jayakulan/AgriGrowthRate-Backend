const Chat = require('../models/Chat');
const ragService = require('../services/ragService');
const User = require('../models/User');

// @desc  Send message to AI chatbot (RAG)
// @route POST /api/chat/message
exports.sendMessage = async (req, res, next) => {
  try {
    const { message, chatId, context } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    // Subscription Expiry Check
    if (user.isSubscribed && user.subscriptionExpiry && new Date() > user.subscriptionExpiry) {
      user.isSubscribed = false;
      user.freeChatCount = 0; // Force them to pay again since they already used their free tier
      await user.save();
    }

    // Subscription Limit Check
    if (!user.isSubscribed && user.freeChatCount <= 0) {
      return res.status(402).json({ 
        success: false, 
        message: 'Free chat limit reached or subscription expired. Please subscribe to continue.',
        requiresPayment: true
      });
    }

    // Get or create chat session
    let chat = chatId ? await Chat.findById(chatId) : null;
    if (!chat) {
      chat = await Chat.create({ user: req.user.id, context: context || 'general', messages: [] });
    }

    // Add user message
    chat.messages.push({ role: 'user', content: message });

    // Format messages for OpenAI
    const formattedMessages = chat.messages.map(m => ({ role: m.role, content: m.content }));

    // Get AI response via RAG
    const ragContext = await ragService.retrieveContext(message);
    const aiResponse = await ragService.generateChatResponse(formattedMessages, ragContext, user.role);

    // Add assistant response
    chat.messages.push({ role: 'assistant', content: aiResponse });
    if (chat.messages.length <= 2) chat.title = message.substring(0, 50);
    await chat.save();

    // Deduct free chat count if not subscribed
    if (!user.isSubscribed) {
      user.freeChatCount -= 1;
      await user.save();
    }

    res.json({ 
      success: true, 
      data: { chatId: chat._id, reply: aiResponse },
      remainingChats: user.isSubscribed ? 'unlimited' : user.freeChatCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc  Get user chat history
// @route GET /api/chat/history
exports.getChatHistory = async (req, res, next) => {
  try {
    const chats = await Chat.find({ user: req.user.id }).select('title context updatedAt messages').sort('-updatedAt');
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

// @desc  Rename chat
// @route PUT /api/chat/:id/rename
exports.renameChat = async (req, res, next) => {
  try {
    const { title } = req.body;
    const chat = await Chat.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { title },
      { new: true }
    );
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
    res.json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

// @desc  Delete chat
// @route DELETE /api/chat/:id
exports.deleteChat = async (req, res, next) => {
  try {
    const chat = await Chat.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
    res.json({ success: true, message: 'Chat deleted' });
  } catch (error) {
    next(error);
  }
};
