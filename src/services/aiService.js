const axios = require('axios');

/**
 * AI Service - Connects to Python AI model microservice (crop disease detection + RAG chatbot)
 */

const AI_MODEL_URL = process.env.AI_MODEL_URL || 'http://localhost:8000';

// RAG-based chatbot response
exports.generateRAGResponse = async (message, history, context) => {
  try {
    const response = await axios.post(`${AI_MODEL_URL}/chat`, {
      message,
      history: history.slice(-10), // Last 10 messages for context
      context: context || 'general',
    });
    return response.data.reply;
  } catch (error) {
    console.error('AI Service Error (RAG):', error.message);
    return "I'm sorry, I'm having trouble connecting to my AI services right now. Please try again later.";
  }
};

// Crop disease detection from image
exports.detectCropDisease = async (imagePath) => {
  try {
    const FormData = require('form-data');
    const fs = require('fs');
    const form = new FormData();
    form.append('image', fs.createReadStream(imagePath));

    const response = await axios.post(`${AI_MODEL_URL}/detect-disease`, form, {
      headers: form.getHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error('AI Service Error (Disease Detection):', error.message);
    throw new Error('Disease detection service unavailable');
  }
};

// Crop recommendations based on conditions
exports.getCropRecommendations = async (cropType, location, season) => {
  try {
    const response = await axios.post(`${AI_MODEL_URL}/recommend`, { cropType, location, season });
    return response.data;
  } catch (error) {
    console.error('AI Service Error (Recommendations):', error.message);
    return { recommendations: [], message: 'Recommendation service temporarily unavailable' };
  }
};

// Weather advisory via AI
exports.getWeatherAdvisory = async (lat, lon) => {
  const weatherData = await require('./weatherService').getWeather(lat, lon);
  try {
    const response = await axios.post(`${AI_MODEL_URL}/weather-advisory`, { weatherData });
    return response.data;
  } catch (error) {
    return { advisory: 'Weather advisory unavailable', weather: weatherData };
  }
};
