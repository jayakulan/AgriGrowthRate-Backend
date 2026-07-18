const express = require('express');
const router = express.Router();
const multer = require('multer');
const { detectDisease, getRecommendations, getWeatherAdvisory, uploadKnowledgeBase, chatWithAI, generateReport, getKnowledgeBases, saveAssessment, getAssessments, deleteKnowledgeBase } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

const upload = multer({ dest: 'uploads/' });

router.post('/detect-disease', protect, upload.single('image'), detectDisease);
router.post('/recommend', protect, getRecommendations);
router.get('/weather-advisory', protect, getWeatherAdvisory);

// RAG Routes
router.get('/knowledge', protect, getKnowledgeBases);
router.delete('/knowledge/:id', protect, deleteKnowledgeBase);
router.post('/upload-knowledge', protect, upload.single('pdf'), uploadKnowledgeBase);
router.post('/chat', protect, chatWithAI);
router.post('/generate-report', protect, generateReport);

// Assessment history routes
router.post('/assessments', protect, saveAssessment);
router.get('/assessments', protect, getAssessments);

module.exports = router;
