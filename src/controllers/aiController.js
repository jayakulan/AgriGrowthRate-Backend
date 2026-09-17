const aiService = require('../services/aiService');
const DiseaseScan = require('../models/DiseaseScan');
const ragService = require('../services/ragService');
const KnowledgeBase = require('../models/KnowledgeBase');
const User = require('../models/User');
const { findById, find } = require('../utils/dbHelpers');
const { uploadBase64ToS3 } = require('../utils/s3Helper');

// @desc  Detect crop disease from uploaded image
// @route POST /api/ai/detect-disease
exports.detectDisease = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image provided' });
    const imagePath = req.file.location || req.file.path;
    const result = await aiService.detectCropDisease(imagePath);
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

// @desc Upload knowledge base PDF (Admin)
// @route POST /api/ai/upload-knowledge
exports.uploadKnowledgeBase = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No PDF provided' });
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const s3Url = req.file.location || `/uploads/${req.file.filename}`;

    const doc = await KnowledgeBase.create({
      filename: req.file.filename || req.file.key || 'document.pdf',
      originalName: req.body.datasetName || req.file.originalname,
      fileSize: req.file.size || 0,
      uploadedBy: req.user.id,
      s3Url,
      status: 'processing'
    });

    const targetPath = req.file.path || req.file.location || s3Url;
    ragService.processAndStorePDF(targetPath, doc.id).catch(console.error);

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
    const docs = await find(KnowledgeBase);
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
    const doc = await findById(KnowledgeBase, req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Knowledge base not found' });
    }
    await KnowledgeBase.delete(req.params.id);
    res.json({ success: true, message: 'Knowledge base deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc  Save disease assessment
// @route POST /api/ai/assessments
exports.saveAssessment = async (req, res, next) => {
  try {
    let { crop, diseaseName, confidence, treatment, image } = req.body;
    
    let imageUrl = image;
    if (image) {
      imageUrl = await uploadBase64ToS3(image, 'disease-scans');
    }

    const scan = await DiseaseScan.create({
      user: req.user.id,
      crop: crop || 'General Crop',
      diseaseName: diseaseName || 'Healthy / Inspected',
      confidence: typeof confidence === 'number' ? confidence : 100,
      treatment: treatment || 'No specific action required.',
      image: imageUrl || 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?w=100&h=100&fit=crop'
    });
    
    res.status(201).json({ success: true, data: scan });
  } catch (error) {
    console.error('Error in saveAssessment:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to save assessment' });
  }
};

// @desc  Get disease assessments history
// @route GET /api/ai/assessments
exports.getAssessments = async (req, res, next) => {
  try {
    const scans = await find(DiseaseScan, { user: req.user.id });
    const recentScans = Array.isArray(scans) ? scans.slice(0, 10) : [];
    const monthlyStats = Array(7).fill(0);

    res.json({ 
      success: true, 
      data: {
        recentScans,
        monthlyStats
      } 
    });
  } catch (error) {
    console.error('Error in getAssessments:', error.message);
    res.json({ 
      success: true, 
      data: {
        recentScans: [],
        monthlyStats: Array(7).fill(0)
      } 
    });
  }
};

// @desc Chat with RAG AI
// @route POST /api/ai/chat
exports.chatWithAI = async (req, res, next) => {
  try {
    const { messages } = req.body;
    const user = await findById(User, req.user.id);
    const currentFreeCount = typeof user.freeChatCount === 'number' ? user.freeChatCount : 5;

    if (!user.isSubscribed && currentFreeCount <= 0) {
      return res.status(402).json({ 
        success: false, 
        message: 'Free chat limit reached. Please subscribe to continue.',
        requiresPayment: true
      });
    }

    const lastUserMessage = messages[messages.length - 1]?.content;
    const context = await ragService.retrieveContext(lastUserMessage || '');
    
    const reply = await ragService.generateChatResponse(messages, context, user.role);

    if (!user.isSubscribed) {
      const newCount = Math.max(0, currentFreeCount - 1);
      await User.update({ id: user.id }, { freeChatCount: newCount });
      user.freeChatCount = newCount;
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
    res.json({ success: true, data: reportText });
  } catch (error) {
    next(error);
  }
};
