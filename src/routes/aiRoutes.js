const express = require('express');
const router = express.Router();
const multer = require('multer');
const { detectDisease, getRecommendations, getWeatherAdvisory, uploadKnowledgeBase, chatWithAI, generateReport } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

const upload = multer({ dest: 'uploads/' });

router.post('/detect-disease', protect, upload.single('image'), detectDisease);
router.post('/recommend', protect, getRecommendations);
router.get('/weather-advisory', protect, getWeatherAdvisory);

// RAG Routes
router.post('/upload-knowledge', protect, upload.single('pdf'), uploadKnowledgeBase);
router.post('/chat', protect, chatWithAI);
router.post('/generate-report', protect, generateReport);

module.exports = router;
