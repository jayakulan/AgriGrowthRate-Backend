const Chat = require('../models/Chat');
const ragService = require('../services/ragService');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { findById, find } = require('../utils/dbHelpers');

// @desc  Send message to AI chatbot (RAG)
// @route POST /api/chat/message
exports.sendMessage = async (req, res, next) => {
  try {
    const { message, chatId, context } = req.body;
    const user = await findById(User, req.user.id);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    if (user.isSubscribed && user.subscriptionExpiry && Date.now() > user.subscriptionExpiry) {
      await User.update({ id: user.id }, { isSubscribed: false, freeChatCount: 0 });
      user.isSubscribed = false;
      user.freeChatCount = 0;
    }

    if (!user.isSubscribed && user.freeChatCount <= 0) {
      return res.status(402).json({ 
        success: false, 
        message: 'Free chat limit reached or subscription expired. Please subscribe to continue.',
        requiresPayment: true
      });
    }

    let chat = chatId ? await findById(Chat, chatId) : null;
    if (!chat) {
      chat = await Chat.create({ user: req.user.id, context: context || 'general', messages: [] });
    }

    const currentMessages = Array.isArray(chat.messages) ? [...chat.messages] : [];
    currentMessages.push({ role: 'user', content: message, timestamp: Date.now() });

    let aiResponse = "";

    if (context === 'consumer_recommendation') {
      const msgLower = message.trim().toLowerCase();
      const isOption1 = msgLower === '1' || msgLower.includes('highest demand') || msgLower.includes('top demand');
      const isOption2 = msgLower === '2' || msgLower.includes('selling well') || msgLower.includes('top seller') || msgLower.includes('this month');
      const isOption3 = msgLower === '3' || msgLower.includes('current season') || msgLower.includes('seasonal pick') || msgLower.includes('recommended');
       
      if (isOption1 || isOption2) {
        try {
          const allProducts = await find(Product);
          const topProducts = allProducts.slice(0, 5);

          if (topProducts.length === 0) {
            aiResponse = "Currently, there are no product records to determine demand.";
          } else {
            aiResponse = isOption1 
              ? "Here are the products with the highest overall demand based on our records:\n\n"
              : "Here are the products selling well this month based on our records:\n\n";
                
            topProducts.forEach((prod, index) => {
              aiResponse += `${index + 1}. **${prod.name}** - ${prod.stock > 0 ? 'In Stock' : 'Popular'}.\n`;
            });
          }
        } catch (err) {
          console.error("DB Query error in chatbot:", err);
          aiResponse = "Sorry, I couldn't fetch the database records at the moment.";
        }
      } else if (isOption3) {
        const aiQuery = "What products are recommended for the current season?";
        const modifiedMessages = currentMessages.map(m => ({ 
          role: m.role, 
          content: (m.content === '3' || m.content.toLowerCase().includes('season')) ? aiQuery : m.content 
        }));
        const ragContext = await ragService.retrieveContext(aiQuery);
        aiResponse = await ragService.generateChatResponse(modifiedMessages, ragContext, user.role);
      } else {
        const formattedMessages = currentMessages.map(m => ({ role: m.role, content: m.content }));
        const ragContext = await ragService.retrieveContext(message);
        aiResponse = await ragService.generateChatResponse(formattedMessages, ragContext, user.role);
      }
    } else {
      const formattedMessages = currentMessages.map(m => ({ role: m.role, content: m.content }));
      const ragContext = await ragService.retrieveContext(message);
      aiResponse = await ragService.generateChatResponse(formattedMessages, ragContext, user.role);
    }

    currentMessages.push({ role: 'assistant', content: aiResponse, timestamp: Date.now() });
    const updateTitle = currentMessages.length <= 2 ? message.substring(0, 50) : chat.title;

    const updatedChat = await Chat.update(
      { id: chat.id }, 
      { messages: currentMessages, title: updateTitle }
    );

    if (!user.isSubscribed) {
      const newCount = user.freeChatCount - 1;
      await User.update({ id: user.id }, { freeChatCount: newCount });
      user.freeChatCount = newCount;
    }

    res.json({ 
      success: true, 
      data: { chatId: chat.id, reply: aiResponse },
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
    const chats = await find(Chat, { user: req.user.id });
    res.json({ success: true, data: chats });
  } catch (error) {
    next(error);
  }
};

// @desc  Get single chat with messages
// @route GET /api/chat/:id
exports.getChat = async (req, res, next) => {
  try {
    const chat = await findById(Chat, req.params.id);
    if (!chat || chat.user !== req.user.id) return res.status(404).json({ success: false, message: 'Chat not found' });
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
    const chat = await findById(Chat, req.params.id);
    if (!chat || chat.user !== req.user.id) return res.status(404).json({ success: false, message: 'Chat not found' });

    const updated = await Chat.update({ id: req.params.id }, { title });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

// @desc  Delete chat
// @route DELETE /api/chat/:id
exports.deleteChat = async (req, res, next) => {
  try {
    const chat = await findById(Chat, req.params.id);
    if (!chat || chat.user !== req.user.id) return res.status(404).json({ success: false, message: 'Chat not found' });

    await Chat.delete(req.params.id);
    res.json({ success: true, message: 'Chat deleted' });
  } catch (error) {
    next(error);
  }
};
