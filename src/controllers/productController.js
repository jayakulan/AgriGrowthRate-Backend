const Product = require('../models/Product');

// @desc  Get all products (with optional filters)
// @route GET /api/products
exports.getProducts = async (req, res, next) => {
  try {
    const { category, minPrice, maxPrice, search, page = 1, limit = 12 } = req.query;
    const query = {};
    if (category) query.category = category;
    if (minPrice || maxPrice) query.price = { $gte: minPrice || 0, $lte: maxPrice || Infinity };
    if (search) query.name = { $regex: search, $options: 'i' };

    const products = await Product.find(query)
      .populate('farmer', 'name avatar location')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort('-createdAt');
    const total = await Product.countDocuments(query);

    res.json({ success: true, total, page: Number(page), data: products });
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
    res.json({ success: true, data: product });
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
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, farmer: req.user.id },
      req.body,
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
