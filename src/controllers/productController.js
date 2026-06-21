const mongoose = require('mongoose');
const Product = require('../models/Product');

// @desc  Get all products (with optional filters)
// @route GET /api/products
exports.getProducts = async (req, res, next) => {
  try {
    const { category, minPrice, maxPrice, search, page = 1, limit = 12 } = req.query;
    const query = { status: 'Active', isAvailable: true, stock: { $gt: 0 } };
    if (category) query.category = category;
    if (minPrice || maxPrice) query.price = { $gte: minPrice || 0, $lte: maxPrice || Infinity };
    if (search) query.name = { $regex: search, $options: 'i' };

    const products = await Product.find(query)
      .populate('farmer', 'name avatar location')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort('-createdAt');
    const total = await Product.countDocuments(query);

    // Compute farmer average rating dynamically
    const farmerIds = [...new Set(products.map(p => p.farmer && p.farmer._id.toString()).filter(Boolean))];
    const Feedback = require('../models/Feedback');
    const ratings = await Feedback.aggregate([
      { $match: { reviewee: { $in: farmerIds.map(id => new mongoose.Types.ObjectId(id)) }, reviewerRole: 'consumer' } },
      { $group: { _id: '$reviewee', avgRating: { $avg: '$rating' }, totalReviews: { $sum: 1 } } }
    ]);

    const ratingMap = {};
    ratings.forEach(r => {
      ratingMap[r._id.toString()] = {
        avgRating: Math.round(r.avgRating * 10) / 10,
        totalReviews: r.totalReviews
      };
    });

    const productsWithRating = products.map(product => {
      const prodObj = product.toObject();
      if (prodObj.farmer) {
        const ratingInfo = ratingMap[prodObj.farmer._id.toString()] || { avgRating: 0, totalReviews: 0 };
        prodObj.farmer.avgRating = ratingInfo.avgRating;
        prodObj.farmer.totalReviews = ratingInfo.totalReviews;
      }
      return prodObj;
    });

    res.json({ success: true, total, page: Number(page), data: productsWithRating });
  } catch (error) {
    next(error);
  }
};

// @desc  Get logged-in farmer's own products
// @route GET /api/products/my
exports.getMyProducts = async (req, res, next) => {
  try {
    const { category, status, search } = req.query;
    const query = { farmer: req.user.id };
    if (category && category !== 'All') query.category = category.toLowerCase();
    if (status === 'Active') query.isAvailable = true;
    if (status === 'Out of Stock') { query.stock = 0; query.isAvailable = false; }
    if (status === 'Draft') query.isAvailable = false;
    if (search) query.name = { $regex: search, $options: 'i' };

    const products = await Product.find(query).sort('-createdAt');
    res.json({ success: true, total: products.length, data: products });
  } catch (error) {
    next(error);
  }
};

// @desc  Get single product
// @route GET /api/products/:id
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate('farmer', 'name avatar location phone');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    
    if (product.status !== 'Active' || !product.isAvailable) {
      let isAuthorized = false;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (decoded.id === product.farmer._id.toString() || decoded.role === 'admin') {
            isAuthorized = true;
          }
        } catch (err) {
          // Token validation failed
        }
      }
      
      if (!isAuthorized) {
        return res.status(403).json({ success: false, message: 'Product is not available' });
      }
    }

    // Attach farmer rating
    const Feedback = require('../models/Feedback');
    const ratings = await Feedback.aggregate([
      { $match: { reviewee: product.farmer._id, reviewerRole: 'consumer' } },
      { $group: { _id: '$reviewee', avgRating: { $avg: '$rating' }, totalReviews: { $sum: 1 } } }
    ]);
    
    const prodObj = product.toObject();
    if (prodObj.farmer) {
      const ratingInfo = ratings[0] || { avgRating: 0, totalReviews: 0 };
      prodObj.farmer.avgRating = Math.round((ratingInfo.avgRating || 0) * 10) / 10;
      prodObj.farmer.totalReviews = ratingInfo.totalReviews || 0;
    }

    res.json({ success: true, data: prodObj });
  } catch (error) {
    next(error);
  }
};

// @desc  Create product (Farmer only)
// @route POST /api/products
exports.createProduct = async (req, res, next) => {
  try {
    const product = await Product.create({ ...req.body, farmer: req.user.id });
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// @desc  Update product
// @route PUT /api/products/:id
exports.updateProduct = async (req, res, next) => {
  try {
    const updateData = { ...req.body };
    if (req.user.role === 'farmer') {
      updateData.status = 'Pending Review';
    }
    if (updateData.stock !== undefined && Number(updateData.stock) === 0) {
      updateData.isAvailable = false;
    }
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, farmer: req.user.id },
      updateData,
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ success: false, message: 'Product not found or unauthorized' });
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// @desc  Delete product
// @route DELETE /api/products/:id
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, farmer: req.user.id });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found or unauthorized' });
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    next(error);
  }
};
