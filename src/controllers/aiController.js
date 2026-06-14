const aiService = require('../services/aiService');

// @desc  Detect crop disease from uploaded image
// @route POST /api/ai/detect-disease
exports.detectDisease = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image provided' });
    const result = await aiService.detectCropDisease(req.file.path);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// @desc  Get crop recommendations
// @route POST /api/ai/recommend
exports.getRecommendations = async (req, res, next) => {
  try {
    const { cropType, location, season } = req.body;
    const recommendations = await aiService.getCropRecommendations(cropType, location, season);
    res.json({ success: true, data: recommendations });
  } catch (error) {
    next(error);
  }
};

// @desc  Get weather-based advisory
// @route GET /api/ai/weather-advisory
exports.getWeatherAdvisory = async (req, res, next) => {
  try {
    const { lat, lon } = req.query;
    const advisory = await aiService.getWeatherAdvisory(lat, lon);
    res.json({ success: true, data: advisory });
  } catch (error) {
    next(error);
  }
};

const ragService = require('../services/ragService');
const KnowledgeBase = require('../models/KnowledgeBase');
const User = require('../models/User');

// @desc Upload knowledge base PDF (Admin)
// @route POST /api/ai/upload-knowledge
exports.uploadKnowledgeBase = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No PDF provided' });
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const doc = await KnowledgeBase.create({
      filename: req.file.filename,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      uploadedBy: req.user._id,
      status: 'processing'
    });

    // Process asynchronously so we don't block the response
    ragService.processAndStorePDF(req.file.path, doc._id).catch(console.error);

    res.json({ success: true, data: doc, message: 'PDF uploaded and is being processed' });
  } catch (error) {
    next(error);
  }
};

// @desc Chat with RAG AI
// @route POST /api/ai/chat
exports.chatWithAI = async (req, res, next) => {
  try {
    const { messages } = req.body;
    const user = await User.findById(req.user._id);

    // Subscription Check
    if (!user.isSubscribed && user.freeChatCount <= 0) {
      return res.status(402).json({ 
        success: false, 
        message: 'Free chat limit reached. Please subscribe to continue.',
        requiresPayment: true
      });
    }

    // Get latest message for context retrieval
    const lastUserMessage = messages[messages.length - 1]?.content;
    const context = await ragService.retrieveContext(lastUserMessage || '');
    
    const reply = await ragService.generateChatResponse(messages, context, user.role);

    // Deduct free chat count if not subscribed
    if (!user.isSubscribed) {
      user.freeChatCount -= 1;
      await user.save();
    }

    res.json({ success: true, reply, remainingChats: user.isSubscribed ? 'unlimited' : user.freeChatCount });
  } catch (error) {
    next(error);
  }
};

// @desc Generate Crop Recommendation PDF Report
// @route POST /api/ai/generate-report
exports.generateReport = async (req, res, next) => {
  try {
    const { cropDetails } = req.body;
    const reportText = await ragService.generateCropRecommendationPDF(cropDetails);
    
    // In a real scenario, convert reportText to PDF. Returning text here for frontend to display/convert.
    res.json({ success: true, data: reportText });
  } catch (error) {
    next(error);
  }
};
