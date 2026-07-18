const aiService = require('../services/aiService');
const DiseaseScan = require('../models/DiseaseScan');

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
      originalName: req.body.datasetName || req.file.originalname,
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

// @desc Get all knowledge base documents (Admin)
// @route GET /api/ai/knowledge
exports.getKnowledgeBases = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const docs = await KnowledgeBase.find().sort({ createdAt: -1 });
    res.json({ success: true, data: docs });
  } catch (error) {
    next(error);
  }
};

// @desc Delete a knowledge base document (Admin)
// @route DELETE /api/ai/knowledge/:id
exports.deleteKnowledgeBase = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const doc = await KnowledgeBase.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Knowledge base not found' });
    }
    await doc.deleteOne();
    res.json({ success: true, message: 'Knowledge base deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc  Save disease assessment
// @route POST /api/ai/assessments
exports.saveAssessment = async (req, res, next) => {
  try {
    const { crop, diseaseName, confidence, treatment, image } = req.body;
    
    const scan = await DiseaseScan.create({
      user: req.user._id,
      crop,
      diseaseName,
      confidence,
      treatment,
      image: image || 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?w=100&h=100&fit=crop'
    });
    
    res.status(201).json({ success: true, data: scan });
  } catch (error) {
    next(error);
  }
};

// @desc  Get disease assessments history
// @route GET /api/ai/assessments
exports.getAssessments = async (req, res, next) => {
  try {
    const scans = await DiseaseScan.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10);
      
    // Calculate monthly stats for the last 7 months
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    date.setDate(1);
    date.setHours(0,0,0,0);
    
    const stats = await DiseaseScan.aggregate([
      { $match: { user: req.user._id, createdAt: { $gte: date } } },
      {
        $group: {
          _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);
    
    // Format stats for frontend
    const monthlyStats = Array(7).fill(0);
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    stats.forEach(stat => {
      // Calculate how many months ago this was (0 to 6)
      let monthsAgo = (currentYear - stat._id.year) * 12 + (currentMonth - stat._id.month);
      if (monthsAgo >= 0 && monthsAgo < 7) {
        monthlyStats[6 - monthsAgo] = stat.count;
      }
    });

    res.json({ 
      success: true, 
      data: {
        recentScans: scans,
        monthlyStats
      } 
    });
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
