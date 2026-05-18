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
