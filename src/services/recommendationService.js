const Product = require('../models/Product');

/**
 * Recommendation Service - Rule-based + AI-assisted crop recommendations
 */

// Get product recommendations for a consumer
exports.getProductRecommendations = async (userId, preferences = {}) => {
  try {
    const { category, maxPrice } = preferences;
    const query = { isAvailable: true, stock: { $gt: 0 } };
    if (category) query.category = category;
    if (maxPrice) query.price = { $lte: maxPrice };

    const products = await Product.find(query)
      .populate('farmer', 'name location')
      .sort('-rating -createdAt')
      .limit(8);
    return products;
  } catch (error) {
    console.error('Recommendation Error:', error.message);
    return [];
  }
};

// Get seasonal crop recommendations
exports.getSeasonalRecommendations = (season, region) => {
  const recommendations = {
    summer: { crops: ['tomatoes', 'peppers', 'cucumbers', 'corn'], tip: 'Focus on heat-tolerant crops' },
    winter: { crops: ['spinach', 'kale', 'broccoli', 'carrots'], tip: 'Root vegetables thrive in cold' },
    monsoon: { crops: ['rice', 'maize', 'soybeans', 'ginger'], tip: 'High rainfall crops do best' },
    spring: { crops: ['peas', 'lettuce', 'radish', 'onions'], tip: 'Mild crops for mild weather' },
  };
  return recommendations[season] || recommendations['summer'];
};
