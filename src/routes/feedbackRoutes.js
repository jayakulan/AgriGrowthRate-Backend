const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Order = require('../models/Order');
const Feedback = require('../models/Feedback');
const Product = require('../models/Product');

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

    const order = await Order.findById(orderId).populate('items.product');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Feedback can only be submitted for completed orders' });
    }

    let revieweeId = null;
    let productId = null;
    let reviewerRole = null;

    if (req.user.role === 'consumer' || (req.user.role !== 'farmer' && order.consumer.toString() === req.user._id.toString())) {
      // Reviewer is the consumer
      if (order.consumer.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to review this order' });
      }

      if (order.isReviewedByConsumer) {
        return res.status(400).json({ success: false, message: 'You have already submitted feedback for this order' });
      }

      // Find the farmer (reviewee) of the product
      const firstItem = order.items?.[0];
      if (!firstItem || !firstItem.product) {
        return res.status(400).json({ success: false, message: 'Order items are invalid' });
      }

      revieweeId = firstItem.product.farmer;
      productId = firstItem.product._id;
      reviewerRole = 'consumer';
      order.isReviewedByConsumer = true;

    } else if (req.user.role === 'farmer') {
      // Reviewer is the farmer
      // Verify this farmer owns at least one product in this order
      const firstItem = order.items?.[0];
      if (!firstItem || !firstItem.product) {
        return res.status(400).json({ success: false, message: 'Order items are invalid' });
      }

      const productFarmer = firstItem.product.farmer.toString();
      if (productFarmer !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to review this order' });
      }

      if (order.isReviewedByFarmer) {
        return res.status(400).json({ success: false, message: 'You have already submitted feedback for this order' });
      }

      revieweeId = order.consumer;
      productId = firstItem.product._id;
      reviewerRole = 'farmer';
      order.isReviewedByFarmer = true;
    } else {
      return res.status(403).json({ success: false, message: 'Invalid role for submitting feedback' });
    }

    if (!revieweeId) {
      return res.status(400).json({ success: false, message: 'Could not determine the reviewee' });
    }

    const feedback = await Feedback.create({
      order: order._id,
      reviewer: req.user._id,
      reviewee: revieweeId,
      product: productId,
      rating: numericRating,
      comment,
      reviewerRole,
    });

    await order.save();

    res.status(201).json({
      success: true,
      data: feedback,
      message: 'Feedback submitted successfully',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
