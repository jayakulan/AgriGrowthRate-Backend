const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Conversation = require('../models/Conversation');

// @desc  Create order
// @route POST /api/orders
// @access Private
router.post('/', protect, async (req, res, next) => {
  try {
    const { items, paymentMethod, shippingAddress } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide items for the order' });
    }

    let totalAmount = 0;
    const orderItems = [];

    // Verify products and calculate total
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product not found: ${item.product}` });
      }

      if (item.quantity < 10) {
        return res.status(400).json({ success: false, message: `Minimum purchase quantity is 10 for product ${product.name}` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for product ${product.name}` });
      }

      // Decrement stock
      product.stock -= item.quantity;
      if (product.stock === 0) {
        product.isAvailable = false;
      }
      await product.save();

      totalAmount += product.price * item.quantity;
      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price
      });
    }

    // Generate confirmation number
    const confirmNum = 'AGR-' + Math.floor(100000 + Math.random() * 900000).toString();

    const order = await Order.create({
      consumer: req.user._id,
      items: orderItems,
      totalAmount,
      paymentMethod: paymentMethod || 'cash',
      orderConfirmationNumber: confirmNum,
      shippingAddress: shippingAddress || {
        street: 'N/A',
        city: 'N/A',
        state: 'N/A',
        pincode: 'N/A',
        country: 'Sri Lanka'
      }
    });

    // Create a chat conversation for each unique farmer involved in the order
    const farmerIds = new Set();
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (product && product.farmer) {
        farmerIds.add(product.farmer.toString());
      }
    }

    for (const farmerId of farmerIds) {
      // Check if conversation already exists
      let conversation = await Conversation.findOne({
        participants: { $all: [req.user._id, farmerId] }
      });

      if (!conversation) {
        await Conversation.create({
          participants: [req.user._id, farmerId],
          order: order._id
        });
      }
    }

    // Send order confirmation number via SMS using text.lk
    if (req.user.phone) {
      const smsUrl = process.env.TEXT_LK_API_URL;
      const smsToken = process.env.TEXT_LK_API_TOKEN;
      const senderId = process.env.TEXT_LK_SENDER_ID;

      if (smsUrl && smsToken && senderId) {
        try {
          await fetch(smsUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${smsToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              recipient: req.user.phone,
              sender_id: senderId,
              type: 'plain',
              message: `Your AgriGrowthRate order has been placed successfully! Confirmation Number: ${confirmNum}. Total: $${totalAmount.toFixed(2)}`
            })
          });
          console.log(`[Order SMS] Successfully sent confirmation SMS to ${req.user.phone}`);
        } catch (smsErr) {
          console.error('Failed to send order confirmation SMS:', smsErr);
        }
      } else {
        console.warn('[SMS Warn] Gateway variables missing. SMS not sent.');
      }
    }

    res.status(201).json({
      success: true,
      data: order,
      message: 'Order placed successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @desc  Get orders for products owned by the farmer
// @route GET /api/orders/farmer
// @access Private
router.get('/farmer', protect, async (req, res, next) => {
  try {
    if (req.user.role !== 'farmer' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized as a farmer' });
    }

    // 1. Find all products owned by this farmer
    const products = await Product.find({ farmer: req.user._id });
    const productIds = products.map(p => p._id);

    // 2. Find orders containing any of these products
    const orders = await Order.find({ 'items.product': { $in: productIds } })
      .populate('consumer', 'name email avatar phone')
      .populate('items.product', 'name price images farmer')
      .sort('-createdAt');

    // 3. For each order, filter items to only include this farmer's products
    // (if a multi-vendor order model is used, though in "Buy Now" it's 1 product per order)
    const farmerOrders = orders.map(order => {
      const orderObj = order.toObject();
      orderObj.items = orderObj.items.filter(item => 
        item.product && item.product.farmer && item.product.farmer.toString() === req.user._id.toString()
      );
      return orderObj;
    }).filter(order => order.items.length > 0);

    res.json({
      success: true,
      data: farmerOrders
    });
  } catch (error) {
    next(error);
  }
});

// @desc  Get consumer orders
// @route GET /api/orders/my-orders
// @access Private
router.get('/my-orders', protect, async (req, res, next) => {
  try {
    const orders = await Order.find({ consumer: req.user._id })
      .populate('items.product', 'name price images')
      .sort('-createdAt');

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    next(error);
  }
});

// @desc  Update order status (farmer/admin)
// @route PUT /api/orders/:id/status
// @access Private
router.put('/:id/status', protect, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Please provide a status' });
    }

    const order = await Order.findById(req.id || req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.status = status;
    if (status === 'delivered') {
      order.deliveredAt = Date.now();
      order.paymentStatus = 'paid'; // Automatically mark paid if delivered
    }
    await order.save();

    res.json({
      success: true,
      data: order,
      message: `Order status updated to ${status}`
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/cancel', protect, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Verify authorization: either the consumer or the farmer who owns the product can cancel
    const isConsumer = order.consumer.toString() === req.user._id.toString();
    const isFarmer = order.items.some(item => 
      item.product && item.product.farmer && item.product.farmer.toString() === req.user._id.toString()
    );

    if (!isConsumer && !isFarmer && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this order' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending orders can be cancelled' });
    }

    // Revert product stock
    for (const item of order.items) {
      const product = await Product.findById(item.product._id || item.product);
      if (product) {
        product.stock += item.quantity;
        product.isAvailable = true; // Mark as available again if stock was 0
        await product.save();
      }
    }

    order.status = 'cancelled';
    await order.save();

    res.json({
      success: true,
      data: order,
      message: 'Order cancelled successfully and stock updated'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
