const express = require('express');
const router = express.Router();
const uploadS3 = require('../middleware/s3Upload');
const { detectDisease, getRecommendations, getWeatherAdvisory, uploadKnowledgeBase, chatWithAI, generateReport, getKnowledgeBases, saveAssessment, getAssessments, deleteKnowledgeBase } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

router.post('/detect-disease', protect, uploadS3.single('image'), detectDisease);
router.post('/recommend', protect, getRecommendations);
router.get('/weather-advisory', protect, getWeatherAdvisory);

// RAG Routes
router.get('/knowledge', protect, getKnowledgeBases);
router.delete('/knowledge/:id', protect, deleteKnowledgeBase);
router.post('/upload-knowledge', protect, uploadS3.single('pdf'), uploadKnowledgeBase);
router.post('/chat', protect, chatWithAI);
router.post('/generate-report', protect, generateReport);

// Assessment history routes
router.post('/assessments', protect, saveAssessment);
router.get('/assessments', protect, getAssessments);

module.exports = router;
