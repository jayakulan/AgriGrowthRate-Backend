const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Chat = require('../models/Chat');

// @desc  Get dashboard analytics
// @route GET /api/admin/analytics
exports.getDashboardAnalytics = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const farmers = await User.countDocuments({ role: 'farmer' });
    const consumers = await User.countDocuments({ role: 'consumer' });
    const adminCount = await User.countDocuments({ role: 'admin' });
    
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ status: 'Active' });
    const pendingProducts = await Product.countDocuments({ status: 'Pending Review' });
    
    const totalOrders = await Order.countDocuments();
    const deliveredOrders = await Order.countDocuments({ status: 'Delivered' });
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
        orders: { total: totalOrders, delivered: deliveredOrders, pending: pendingOrders },
        revenue: totalRevenue,
        monthlyOrderTrend: monthlyData,
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
    
    let query = {};
    if (status) query.status = status;
    if (category) query.category = category;
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];

    const products = await Product.find(query)
      .populate('farmer', 'name email phone')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });
    
    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      data: products,
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
    const { status } = req.body;
    if (!['Active', 'Inactive', 'Pending Review', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('farmer', 'name email');

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

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
    if (status) query.status = status;

    const orders = await Order.find(query)
      .populate('consumer', 'name email phone')
      .populate('farmer', 'name email phone')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });
    
    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: orders,
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
    const orders = await Order.find().select('totalAmount createdAt status');
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

    res.json({
      success: true,
      data: {
        topProducts,
        userGrowth,
        revenueData,
        categoryBreakdown: categoryData,
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
    const { name, phone, address, avatar } = req.body;
    
    const admin = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone, address, avatar },
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
