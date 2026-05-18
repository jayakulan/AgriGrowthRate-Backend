const express = require('express');
const router = express.Router();
const multer = require('multer');
const { detectDisease, getRecommendations, getWeatherAdvisory } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

const upload = multer({ dest: 'uploads/' });

router.post('/detect-disease', protect, upload.single('image'), detectDisease);
router.post('/recommend', protect, getRecommendations);
router.get('/weather-advisory', protect, getWeatherAdvisory);

module.exports = router;
