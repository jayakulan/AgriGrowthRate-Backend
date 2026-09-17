const Product = require('../models/Product');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const jwt = require('jsonwebtoken');
const { findById, findOne, find } = require('../utils/dbHelpers');
const { processImagesToS3 } = require('../utils/s3Helper');

// @desc  Get all products (with optional filters)
// @route GET /api/products
exports.getProducts = async (req, res, next) => {
  try {
    const { category, minPrice, maxPrice, search, page = 1, limit = 12 } = req.query;
    
    let products = await find(Product);

    products = products.filter((p) => {
      if (p.status !== 'Active' || p.isAvailable === false || p.stock <= 0) return false;
      if (category && category !== 'All' && p.category.toLowerCase() !== category.toLowerCase()) return false;
      if (minPrice && p.price < Number(minPrice)) return false;
      if (maxPrice && p.price > Number(maxPrice)) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    const total = products.length;
    const startIndex = (Number(page) - 1) * Number(limit);
    const paginatedProducts = products.slice(startIndex, startIndex + Number(limit));

    const productsWithRating = await Promise.all(
      paginatedProducts.map(async (prod) => {
        const prodObj = { ...prod };
        const farmer = await findById(User, prod.farmer);
        if (farmer) {
          const farmerFeedbacks = await find(Feedback, { reviewee: farmer.id, reviewerRole: 'consumer' });
          const totalReviews = farmerFeedbacks.length;
          const avgRating = totalReviews > 0
            ? Math.round((farmerFeedbacks.reduce((acc, curr) => acc + curr.rating, 0) / totalReviews) * 10) / 10
            : 0;

          prodObj.farmer = {
            id: farmer.id,
            name: farmer.name,
            avatar: farmer.avatar,
            location: farmer.location,
            address: farmer.address,
            avgRating,
            totalReviews
          };
        }
        return prodObj;
      })
    );

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
    let products = await find(Product, { farmer: req.user.id });

    if (category && category !== 'All') {
      products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }
    if (status === 'Active') {
      products = products.filter(p => p.isAvailable === true);
    }
    if (status === 'Out of Stock') {
      products = products.filter(p => p.stock === 0 || p.isAvailable === false);
    }
    if (search) {
      products = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    }

    res.json({ success: true, total: products.length, data: products });
  } catch (error) {
    next(error);
  }
};

// @desc  Get single product
// @route GET /api/products/:id
exports.getProduct = async (req, res, next) => {
  try {
    const product = await findById(Product, req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    
    if (product.status !== 'Active' || !product.isAvailable) {
      let isAuthorized = false;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (decoded.id === product.farmer || decoded.role === 'admin') {
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

    const prodObj = { ...product };
    const farmer = await findById(User, product.farmer);
    if (farmer) {
      const farmerFeedbacks = await find(Feedback, { reviewee: farmer.id, reviewerRole: 'consumer' });
      const totalReviews = farmerFeedbacks.length;
      const avgRating = totalReviews > 0
        ? Math.round((farmerFeedbacks.reduce((acc, curr) => acc + curr.rating, 0) / totalReviews) * 10) / 10
        : 0;

      prodObj.farmer = {
        id: farmer.id,
        name: farmer.name,
        avatar: farmer.avatar,
        location: farmer.location,
        address: farmer.address,
        phone: farmer.phone,
        avgRating,
        totalReviews
      };
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
    let images = req.files && req.files.length > 0 
      ? req.files.map(file => file.location || `/uploads/${file.filename}`)
      : req.body.images || [];

    // Ensure all base64 images are uploaded to AWS S3 and replaced with S3 HTTPS URLs
    images = await processImagesToS3(images, 'products');

    const product = await Product.create({ 
      ...req.body, 
      images,
      farmer: req.user.id 
    });

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// @desc  Update product
// @route PUT /api/products/:id
exports.updateProduct = async (req, res, next) => {
  try {
    const product = await findById(Product, req.params.id);
    if (!product || (product.farmer !== req.user.id && req.user.role !== 'admin')) {
      return res.status(404).json({ success: false, message: 'Product not found or unauthorized' });
    }

    const updateData = { ...req.body };
    if (req.user.role === 'farmer') {
      updateData.status = 'Pending Review';
    }
    if (updateData.stock !== undefined && Number(updateData.stock) === 0) {
      updateData.isAvailable = false;
    }

    let images = updateData.images || [];
    if (req.files && req.files.length > 0) {
      images = req.files.map(file => file.location || `/uploads/${file.filename}`);
    }

    if (images.length > 0) {
      updateData.images = await processImagesToS3(images, 'products');
    }

    const updatedProduct = await Product.update({ id: req.params.id }, updateData);
    res.json({ success: true, data: updatedProduct });
  } catch (error) {
    next(error);
  }
};

// @desc  Delete product
// @route DELETE /api/products/:id
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await findById(Product, req.params.id);
    if (!product || (product.farmer !== req.user.id && req.user.role !== 'admin')) {
      return res.status(404).json({ success: false, message: 'Product not found or unauthorized' });
    }

    await Product.delete(req.params.id);
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    next(error);
  }
};
