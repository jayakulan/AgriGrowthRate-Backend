const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { findById, find } = require('../utils/dbHelpers');

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
      const product = await findById(Product, item.product);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product not found: ${item.product}` });
      }

      if (item.quantity < 10) {
        return res.status(400).json({ success: false, message: `Minimum purchase quantity is 10 for product ${product.name}` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for product ${product.name}` });
      }

      const newStock = product.stock - item.quantity;
      const isAvailable = newStock > 0;
      await Product.update({ id: product.id }, { stock: newStock, isAvailable });

      totalAmount += product.price * item.quantity;
      orderItems.push({
        product: product.id,
        productName: product.name,
        quantity: item.quantity,
        price: product.price
      });
    }

    const confirmNum = 'AGR-' + Math.floor(100000 + Math.random() * 900000).toString();

    const order = await Order.create({
      consumer: req.user.id,
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

    const farmerIds = new Set();
    for (const item of items) {
      const product = await findById(Product, item.product);
      if (product && product.farmer) {
        farmerIds.add(product.farmer);
      }
    }

    for (const farmerId of farmerIds) {
      const allConvs = await find(Conversation);
      const existing = allConvs.find(c => 
        c.participants && c.participants.includes(req.user.id) && c.participants.includes(farmerId)
      );

      if (!existing) {
        await Conversation.create({
          participants: [req.user.id, farmerId],
          order: order.id
        });
      }
    }

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
        } catch (smsErr) {
          console.error('Failed to send order confirmation SMS:', smsErr);
        }
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

    const allProducts = await find(Product, { farmer: req.user.id });
    const productIds = allProducts.map(p => p.id || p._id);

    const allOrders = await find(Order);
    const farmerOrders = [];

    for (const order of allOrders) {
      const relevantItems = order.items ? order.items.filter(item => {
        const pid = typeof item.product === 'object' ? (item.product?.id || item.product?._id) : item.product;
        return productIds.includes(pid);
      }) : [];
      if (relevantItems.length > 0) {
        const consumer = await findById(User, order.consumer);
        const populatedItems = await Promise.all(
          relevantItems.map(async (item) => {
            const pid = typeof item.product === 'object' ? (item.product?.id || item.product?._id) : item.product;
            const pDoc = await findById(Product, pid);
            const fallbackName = (typeof item.product === 'object' && item.product?.name)
              || item.productName
              || (typeof item.product === 'string' ? item.product : 'N/A');

            return {
              ...item,
              product: {
                id: pid || (pDoc ? pDoc.id : ''),
                _id: pid || (pDoc ? pDoc.id : ''),
                name: pDoc ? pDoc.name : fallbackName,
                price: pDoc ? pDoc.price : (item.price || 0),
                images: pDoc ? pDoc.images : (typeof item.product === 'object' && item.product?.images ? item.product.images : []),
                unit: pDoc ? pDoc.unit : (typeof item.product === 'object' && item.product?.unit ? item.product.unit : 'kg')
              }
            };
          })
        );

        farmerOrders.push({
          ...order,
          consumer: consumer ? {
            id: consumer.id,
            name: consumer.name,
            email: consumer.email,
            avatar: consumer.avatar,
            phone: consumer.phone
          } : null,
          items: populatedItems
        });
      }
    }

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
    const orders = await find(Order, { consumer: req.user.id });
    
    const populatedOrders = await Promise.all(
      orders.map(async (order) => {
        const items = await Promise.all(
          (order.items || []).map(async (item) => {
            const pid = typeof item.product === 'object' ? (item.product?.id || item.product?._id) : item.product;
            const product = await findById(Product, pid);
            const fallbackName = (typeof item.product === 'object' && item.product?.name)
              || item.productName
              || (typeof item.product === 'string' ? item.product : 'N/A');

            return {
              ...item,
              product: {
                id: pid || (product ? product.id : ''),
                _id: pid || (product ? product.id : ''),
                name: product ? product.name : fallbackName,
                price: product ? product.price : (item.price || 0),
                images: product ? product.images : (typeof item.product === 'object' && item.product?.images ? item.product.images : [])
              }
            };
          })
        );
        return {
          ...order,
          items
        };
      })
    );

    res.json({
      success: true,
      data: populatedOrders
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

    const order = await findById(Order, req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const updateFields = { status };
    if (status === 'delivered') {
      updateFields.deliveredAt = new Date().toISOString();
      updateFields.paymentStatus = 'paid';
    }

    const updated = await Order.update({ id: req.params.id }, updateFields);

    res.json({
      success: true,
      data: updated,
      message: `Order status updated to ${status}`
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/cancel', protect, async (req, res, next) => {
  try {
    const order = await findById(Order, req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.consumer !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this order' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending orders can be cancelled' });
    }

    for (const item of (order.items || [])) {
      const product = await findById(Product, item.product);
      if (product) {
        const newStock = product.stock + item.quantity;
        await Product.update({ id: product.id }, { stock: newStock, isAvailable: true });
      }
    }

    const updated = await Order.update({ id: req.params.id }, { status: 'cancelled' });

    res.json({
      success: true,
      data: updated,
      message: 'Order cancelled successfully and stock updated'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
