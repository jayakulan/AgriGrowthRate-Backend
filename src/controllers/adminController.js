const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Chat = require('../models/Chat');
const FarmerCard = require('../models/FarmerCard');
const Notification = require('../models/Notification');


// @desc  Get dashboard analytics
// @route GET /api/admin/analytics
exports.getDashboardAnalytics = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const farmers = await User.countDocuments({ role: 'farmer' });
    const consumers = await User.countDocuments({ role: 'consumer' });
    const adminCount = await User.countDocuments({ role: 'admin' });
    
    const activeFarmers = await User.countDocuments({
      role: 'farmer',
      $or: [
        { status: { $regex: /^enabled$/i } },
        { status: { $regex: /^active$/i } },
        { isVerified: true }
      ]
    });
    const activeRetailers = await User.countDocuments({
      $or: [{ role: 'retailer' }, { role: 'consumer' }],
      $or: [
        { status: { $regex: /^enabled$/i } },
        { status: { $regex: /^active$/i } },
        { isVerified: true }
      ]
    });
    const approvedProducts = await Product.countDocuments({
      $or: [
        { approvalStatus: { $regex: /^approved$/i } },
        { status: { $regex: /^active$/i } },
        { status: { $regex: /^approved$/i } }
      ]
    });
    const deliveredOrders = await Order.countDocuments({
      $or: [
        { orderStatus: { $regex: /^delivered$/i } },
        { status: { $regex: /^delivered$/i } }
      ]
    });

    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ status: 'Active' });
    const pendingProducts = await Product.countDocuments({ status: 'Pending Review' });
    
    const totalOrders = await Order.countDocuments();
    const deliveredOrdersOld = await Order.countDocuments({ status: 'Delivered' });
    const pendingOrders = await Order.countDocuments({ status: 'Pending' });
    
    const orders = await Order.find().select('totalAmount createdAt status');
    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    
    const monthlyData = {};
    orders.forEach(order => {
      const month = new Date(order.createdAt).toLocaleString('default', { month: 'short' });
      monthlyData[month] = (monthlyData[month] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        users: { total: totalUsers, farmers, consumers, admins: adminCount },
        products: { total: totalProducts, active: activeProducts, pending: pendingProducts },
        orders: { total: totalOrders, delivered: deliveredOrdersOld, pending: pendingOrders },
        revenue: totalRevenue,
        monthlyOrderTrend: monthlyData,
        activeFarmers,
        activeRetailers,
        approvedProducts,
        deliveredOrders,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc  Get all users with filtering
// @route GET /api/admin/users
exports.getAllUsers = async (req, res, next) => {
  try {
    const { role, search, status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    if (role) query.role = role;
    if (status) query.isVerified = status === 'active';
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];

    const users = await User.find(query)
      .select('-password -refreshToken')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });
    
    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: users,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// @desc  Update user status (activate/deactivate)
// @route PATCH /api/admin/users/:id/status
exports.updateUserStatus = async (req, res, next) => {
  try {
    const { isVerified } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isVerified },
      { new: true }
    ).select('-password -refreshToken');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, data: user, message: 'User status updated' });
  } catch (error) {
    next(error);
  }
};

// @desc  Update user role
// @route PATCH /api/admin/users/:id/role
exports.updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['farmer', 'consumer', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password -refreshToken');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, data: user, message: 'User role updated' });
  } catch (error) {
    next(error);
  }
};

// @desc  Delete user
// @route DELETE /api/admin/users/:id
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc  Get all products with filtering
// @route GET /api/admin/products
exports.getAllProducts = async (req, res, next) => {
  try {
    const { status, category, search, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    let query = { isAvailable: true };
    if (status) {
      if (status.toLowerCase() === 'approved' || status.toLowerCase() === 'active') {
        query.status = 'Active';
      } else if (status.toLowerCase() === 'pending' || status.toLowerCase() === 'pending review') {
        query.status = 'Pending Review';
      } else if (status.toLowerCase() === 'rejected') {
        query.status = 'Rejected';
      } else if (status.toLowerCase() === 'inactive') {
        query.status = 'Inactive';
      } else {
        query.status = status;
      }
    }
    if (category) query.category = category;
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];

    const products = await Product.find(query)
      .populate('farmer', 'name email phone location')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });
    
    const total = await Product.countDocuments(query);
    const totalAll = await Product.countDocuments({ isAvailable: true });
    const totalApproved = await Product.countDocuments({ status: 'Active', isAvailable: true });
    const totalRejected = await Product.countDocuments({ status: 'Rejected', isAvailable: true });

    const mappedProducts = products.map(p => {
      const obj = p.toObject();
      if (obj.status === 'Active') obj.status = 'Approved';
      else if (obj.status === 'Pending Review') obj.status = 'Pending';
      obj.quantity = obj.stock;
      obj.farmerName = obj.farmer?.name || 'Unknown';
      obj.farmerEmail = obj.farmer?.email || '';
      obj.farmerPhone = obj.farmer?.phone || '';
      obj.image = obj.images?.[0] || '';
      obj.dateAdded = obj.createdAt;
      return obj;
    });

    res.json({
      success: true,
      data: mappedProducts,
      counts: {
        all: totalAll,
        approved: totalApproved,
        rejected: totalRejected
      },
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// @desc  Update product status
// @route PATCH /api/admin/products/:id/status
exports.updateProductStatus = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    if (!['Active', 'Inactive', 'Pending Review', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('farmer', 'name email');

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Send notification to farmer if approved or rejected
    if (['Active', 'Rejected'].includes(status)) {
      const type = status === 'Active' ? 'product_approval' : 'product_rejection';
      const title = status === 'Active' ? 'Product Approved' : 'Product Rejected';
      const message = status === 'Active'
        ? `Your product "${product.name}" has been approved and is now active.`
        : `Your product is rejected, Product Name: ${product.name}. Reason: ${reason || 'No reason specified'}`;

      await Notification.create({
        recipient: product.farmer._id,
        type,
        title,
        message
      });
    }

    res.json({ success: true, data: product, message: 'Product status updated' });

  } catch (error) {
    next(error);
  }
};

// @desc  Delete product
// @route DELETE /api/admin/products/:id
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc  Get all orders
// @route GET /api/admin/orders
exports.getAllOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    if (status) {
      if (status.toLowerCase() === 'shipping') {
        query.status = { $in: ['Shipping', 'shipping', 'Shipped', 'shipped'] };
      } else {
        query.status = { $regex: new RegExp(`^${status}$`, 'i') };
      }
    }

    const orders = await Order.find(query)
      .populate('consumer', 'name email phone')
      .populate({
        path: 'items.product',
        populate: {
          path: 'farmer',
          select: 'name email phone'
        }
      })
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });
    
    const total = await Order.countDocuments(query);

    // Calculate counts for cards
    const deliveredCount = await Order.countDocuments({
      status: { $in: ['Delivered', 'delivered'] }
    });
    const shippingCount = await Order.countDocuments({
      status: { $in: ['Shipping', 'shipping', 'Shipped', 'shipped'] }
    });
    const cancelledCount = await Order.countDocuments({
      status: { $in: ['Cancelled', 'cancelled'] }
    });

    // Calculate revenue (delivered order total amount)
    const deliveredOrders = await Order.find({
      status: { $in: ['Delivered', 'delivered'] }
    }).select('totalAmount');
    const revenue = deliveredOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    res.json({
      success: true,
      data: orders,
      counts: {
        delivered: deliveredCount,
        shipping: shippingCount,
        cancelled: cancelledCount,
      },
      revenue,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// @desc  Update order status
// @route PATCH /api/admin/orders/:id/status
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('consumer farmer');

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    res.json({ success: true, data: order, message: 'Order status updated' });
  } catch (error) {
    next(error);
  }
};

// @desc  Get reports and analytics
// @route GET /api/admin/reports
exports.getReports = async (req, res, next) => {
  try {
    const timeframe = req.query.timeframe || 'monthly'; // monthly, quarterly, yearly

    // Top performing products
    const topProducts = await Product.find({ status: 'Active' })
      .sort({ salesCount: -1 })
      .limit(5)
      .select('name price category salesCount');

    // User growth data
    const users = await User.find().select('createdAt');
    const userGrowth = {};
    users.forEach(user => {
      const month = new Date(user.createdAt).toLocaleString('default', { month: 'short', year: '2-digit' });
      userGrowth[month] = (userGrowth[month] || 0) + 1;
    });

    // Revenue analytics
    const orders = await Order.find().select('totalAmount createdAt status items');
    const revenueData = {};
    orders.forEach(order => {
      const month = new Date(order.createdAt).toLocaleString('default', { month: 'short', year: '2-digit' });
      revenueData[month] = (revenueData[month] || 0) + (order.totalAmount || 0);
    });

    // Category breakdown
    const categoryData = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 }, revenue: { $sum: '$price' } } },
      { $sort: { count: -1 } }
    ]);

    // Active Users (enabled farmers + retailers)
    const activeFarmers = await User.countDocuments({
      role: 'farmer',
      $or: [
        { status: { $regex: /^enabled$/i } },
        { status: { $regex: /^active$/i } },
        { isVerified: true }
      ]
    });
    const activeRetailers = await User.countDocuments({
      $or: [{ role: 'retailer' }, { role: 'consumer' }],
      $or: [
        { status: { $regex: /^enabled$/i } },
        { status: { $regex: /^active$/i } },
        { isVerified: true }
      ]
    });
    const activeUsers = activeFarmers + activeRetailers;

    // Products Sold (Sum of quantities of items in completed/delivered/shipping orders)
    let productsSold = 0;
    const completedOrders = orders.filter(o =>
      ['delivered', 'shipping', 'shipped'].includes((o.status || '').toLowerCase())
    );
    completedOrders.forEach(order => {
      if (order.items) {
        order.items.forEach(item => {
          productsSold += (item.quantity || 0);
        });
      }
    });

    // Total Orders (delivered + shipping orders)
    const totalOrdersCount = completedOrders.length;

    // Total Revenue (total delivered order amount)
    const deliveredOrders = orders.filter(o =>
      ['delivered'].includes((o.status || '').toLowerCase())
    );
    const totalRevenue = deliveredOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    res.json({
      success: true,
      data: {
        topProducts,
        userGrowth,
        revenueData,
        categoryBreakdown: categoryData,
        stats: {
          activeUsers,
          productsSold,
          totalOrdersCount,
          totalRevenue
        }
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc  Get AI management data
// @route GET /api/admin/ai-management
exports.getAIManagement = async (req, res, next) => {
  try {
    const chats = await Chat.find().select('query response sentiment createdAt');
    
    const totalQueries = chats.length;
    const avgResponseTime = chats.length > 0 ? Math.random() * 500 + 100 : 0; // Placeholder
    const positiveReactions = Math.floor(totalQueries * 0.88);
    const negativeReactions = Math.floor(totalQueries * 0.02);

    const sentimentData = {};
    chats.forEach(chat => {
      const sentiment = chat.sentiment || 'neutral';
      sentimentData[sentiment] = (sentimentData[sentiment] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        totalQueries,
        avgResponseTime: Math.round(avgResponseTime),
        positiveReactions,
        negativeReactions,
        neutralReactions: totalQueries - positiveReactions - negativeReactions,
        sentimentAnalysis: sentimentData,
        recentActivity: chats.slice(-10).reverse(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc  Get admin profile
// @route GET /api/admin/profile
exports.getAdminProfile = async (req, res, next) => {
  try {
    const admin = await User.findById(req.user.id).select('-password -refreshToken');
    
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.json({ success: true, data: admin });
  } catch (error) {
    next(error);
  }
};

// @desc  Update admin profile
// @route PUT /api/admin/profile
exports.updateAdminProfile = async (req, res, next) => {
  try {
    const { name, phone, address, avatar, location, bio, email } = req.body;
    
    if (name) {
      if (/\d/.test(name)) {
        return res.status(400).json({ success: false, message: 'Name cannot contain numbers' });
      }
      if (!/^[a-zA-Z\s\.\-]+$/.test(name)) {
        return res.status(400).json({ success: false, message: 'Name can only contain alphabetic characters, spaces, dots, or hyphens' });
      }
    }

    const updateData = { name, phone, address, avatar, location, bio };
    
    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== req.user.email) {
        const emailExists = await User.findOne({ email: normalizedEmail, _id: { $ne: req.user.id } });
        if (emailExists) {
          return res.status(400).json({ success: false, message: 'Email address is already in use by another account' });
        }
        updateData.email = normalizedEmail;
      }
    }

    const admin = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true }
    ).select('-password -refreshToken');

    res.json({ success: true, data: admin, message: 'Profile updated successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc  Get admin activity logs
// @route GET /api/admin/activity-logs
exports.getActivityLogs = async (req, res, next) => {
  try {
    // Placeholder for activity logs - this would typically come from a separate collection
    const activities = [
      { id: 1, action: 'Approved Product', target: 'Organic Durum Wheat', timestamp: new Date(Date.now() - 3600000) },
      { id: 2, action: 'Deactivated User', target: 'John Smith', timestamp: new Date(Date.now() - 7200000) },
      { id: 3, action: 'Updated Order Status', target: 'Order #AGR-19293', timestamp: new Date(Date.now() - 10800000) },
    ];

    res.json({ success: true, data: activities });
  } catch (error) {
    next(error);
  }
};

// @desc  Add Farmer Card Number
// @route POST /api/admin/farmer-cards
exports.addFarmerCard = async (req, res, next) => {
  try {
    const { cardNumber } = req.body;
    if (!cardNumber) {
      return res.status(400).json({ success: false, message: 'Card number is required' });
    }

    const existingCard = await FarmerCard.findOne({ cardNumber: cardNumber.trim() });
    if (existingCard) {
      return res.status(400).json({ success: false, message: 'This Card Number already exists' });
    }

    const newCard = await FarmerCard.create({ cardNumber: cardNumber.trim() });
    res.status(201).json({ success: true, data: newCard, message: 'Farmer Card Number added successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc  Get all Farmer Cards
// @route GET /api/admin/farmer-cards
exports.getFarmerCards = async (req, res, next) => {
  try {
    const cards = await FarmerCard.find().sort({ createdAt: -1 });
    res.json({ success: true, data: cards });
  } catch (error) {
    next(error);
  }
};
