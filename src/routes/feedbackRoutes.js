const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Order = require('../models/Order');
const Feedback = require('../models/Feedback');
const Product = require('../models/Product');
const { findById, find } = require('../utils/dbHelpers');

// @desc  Submit feedback/rating for an order
// @route POST /api/feedback
// @access Private
router.post('/', protect, async (req, res, next) => {
  try {
    const { orderId, rating, comment } = req.body;

    if (!orderId || !rating || !comment) {
      return res.status(400).json({ success: false, message: 'Please provide orderId, rating, and comment' });
    }

    const numericRating = Number(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be a number between 1 and 5' });
    }

    const order = await findById(Order, orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const orderStatus = (order.orderStatus || order.status || '').toLowerCase();
    if (orderStatus !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Feedback can only be submitted for completed orders' });
    }

    const currentUserId = (req.user.id || req.user._id || '').toString();
    const orderConsumerId = (order.consumer || '').toString();

    let revieweeId = null;
    let productId = '';
    let reviewerRole = null;

    // Find the product and its farmer from the order items
    let product = null;
    const items = order.items || [];
    for (const item of items) {
      const pid = typeof item.product === 'object'
        ? (item.product?.id || item.product?._id)
        : item.product;
      if (pid) {
        const found = await findById(Product, pid);
        if (found) {
          product = found;
          productId = found.id || found._id || pid;
          if (found.farmer) break;
        } else if (!productId) {
          productId = pid;
        }
      }
    }

    const isConsumer = req.user.role === 'consumer' || (req.user.role !== 'farmer' && orderConsumerId === currentUserId);

    if (isConsumer) {
      // Reviewer is the consumer
      if (orderConsumerId && orderConsumerId !== currentUserId) {
        return res.status(403).json({ success: false, message: 'Not authorized to review this order' });
      }

      if (order.isReviewedByConsumer) {
        return res.status(400).json({ success: false, message: 'You have already submitted feedback for this order' });
      }

      revieweeId = product?.farmer || '';
      reviewerRole = 'consumer';

      // If revieweeId could not be found from product, fallback to order seller or product farmer field
      if (!revieweeId && order.farmer) {
        revieweeId = order.farmer;
      }

      await Order.update({ id: order.id || order._id }, { isReviewedByConsumer: true });

    } else if (req.user.role === 'farmer' || req.user.role === 'admin') {
      // Reviewer is the farmer
      const productFarmer = (product?.farmer || '').toString();
      if (req.user.role === 'farmer' && productFarmer && productFarmer !== currentUserId) {
        return res.status(403).json({ success: false, message: 'Not authorized to review this order' });
      }

      if (order.isReviewedByFarmer) {
        return res.status(400).json({ success: false, message: 'You have already submitted feedback for this order' });
      }

      revieweeId = orderConsumerId;
      reviewerRole = 'farmer';

      await Order.update({ id: order.id || order._id }, { isReviewedByFarmer: true });

    } else {
      return res.status(403).json({ success: false, message: 'Invalid role for submitting feedback' });
    }

    if (!revieweeId) {
      return res.status(400).json({ success: false, message: 'Could not determine the reviewee' });
    }

    const feedback = await Feedback.create({
      order: order.id || order._id,
      reviewer: currentUserId,
      reviewee: revieweeId,
      product: productId || '',
      rating: numericRating,
      comment: comment.trim(),
      reviewerRole,
    });

    res.status(201).json({
      success: true,
      data: feedback,
      message: 'Feedback submitted successfully',
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    next(error);
  }
});

// @desc  Get feedbacks for a product
// @route GET /api/feedback/product/:productId
// @access Public
router.get('/product/:productId', async (req, res, next) => {
  try {
    const feedbacks = await find(Feedback, { product: req.params.productId });
    res.json({ success: true, data: feedbacks });
  } catch (error) {
    next(error);
  }
});

// @desc  Get feedbacks for a user (farmer or consumer)
// @route GET /api/feedback/user/:userId
// @access Public
router.get('/user/:userId', async (req, res, next) => {
  try {
    const feedbacks = await find(Feedback, { reviewee: req.params.userId });
    res.json({ success: true, data: feedbacks });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
