const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Chat = require('../models/Chat');
const FarmerCard = require('../models/FarmerCard');
const Notification = require('../models/Notification');
const OtpVerification = require('../models/OtpVerification');
const { findById, findOne, find, deleteMany } = require('../utils/dbHelpers');
const { uploadBase64ToS3 } = require('../utils/s3Helper');
const os = require('os');

// @desc  Get dashboard analytics
// @route GET /api/admin/analytics
exports.getDashboardAnalytics = async (req, res, next) => {
  try {
    const allUsers = await find(User);
    const totalUsers = allUsers.length;
    const farmers = allUsers.filter(u => u.role === 'farmer').length;
    const consumers = allUsers.filter(u => u.role === 'consumer' || u.role === 'retailer').length;
    const adminCount = allUsers.filter(u => u.role === 'admin').length;
    
    const activeFarmers = allUsers.filter(u => u.role === 'farmer' && u.isVerified && (u.status || '').toLowerCase() !== 'disabled').length;
    const activeRetailers = allUsers.filter(u => (u.role === 'retailer' || u.role === 'consumer') && u.isVerified && (u.status || '').toLowerCase() !== 'disabled').length;

    const allProducts = await find(Product);
    const totalProducts = allProducts.length;
    const activeProducts = allProducts.filter(p => p.status === 'Active').length;
    const pendingProducts = allProducts.filter(p => p.status === 'Pending Review').length;
    const approvedProducts = activeProducts;

    const allOrders = await find(Order);
    const totalOrders = allOrders.length;
    const deliveredOrders = allOrders.filter(o => (o.status || '').toLowerCase() === 'delivered').length;
    const pendingOrders = allOrders.filter(o => (o.status || '').toLowerCase() === 'pending').length;

    const totalRevenue = allOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    
    const monthlyData = {};
    const monthlyRevenue = {};
    allOrders.forEach(order => {
      const month = new Date(order.createdAt || Date.now()).toLocaleString('default', { month: 'short' }).toUpperCase();
      monthlyData[month] = (monthlyData[month] || 0) + 1;
      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (order.totalAmount || 0);
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayOrders = allOrders.filter(o => new Date(o.createdAt || Date.now()) >= startOfToday);
    const totalToday = todayOrders.length;
    const dispatchedToday = todayOrders.filter(o => ['confirmed', 'delivered', 'shipped'].includes((o.status || '').toLowerCase())).length;
    const dispatchPercentage = totalToday > 0 ? Math.round((dispatchedToday / totalToday) * 100) : 100;

    const farmerGrowth = {};
    allUsers.filter(u => u.role === 'farmer').forEach(u => {
      const month = new Date(u.createdAt || Date.now()).toLocaleString('default', { month: 'short' }).toUpperCase();
      farmerGrowth[month] = (farmerGrowth[month] || 0) + 1;
    });

    const retailerGrowth = {};
    allUsers.filter(u => u.role === 'retailer' || u.role === 'consumer').forEach(u => {
      const month = new Date(u.createdAt || Date.now()).toLocaleString('default', { month: 'short' }).toUpperCase();
      retailerGrowth[month] = (retailerGrowth[month] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        users: { total: totalUsers, farmers, consumers, admins: adminCount },
        products: { total: totalProducts, active: activeProducts, pending: pendingProducts },
        orders: { total: totalOrders, delivered: deliveredOrders, pending: pendingOrders },
        revenue: totalRevenue,
        monthlyOrderTrend: monthlyData,
        monthlyRevenueTrend: monthlyRevenue,
        activeFarmers,
        activeRetailers,
        approvedProducts,
        deliveredOrders,
        todayLogistics: {
          totalToday,
          dispatchedToday,
          dispatchPercentage
        },
        farmerGrowthTrend: farmerGrowth,
        retailerGrowthTrend: retailerGrowth
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
    
    let users = await find(User);
    if (role) {
      if (role === 'consumer' || role === 'retailer') {
        users = users.filter(u => u.role === 'consumer' || u.role === 'retailer');
      } else {
        users = users.filter(u => u.role === role);
      }
    }
    if (status) users = users.filter(u => u.isVerified === (status === 'active'));
    if (search) {
      const s = search.toLowerCase();
      users = users.filter(u =>
        (u.name && u.name.toLowerCase().includes(s)) ||
        (u.email && u.email.toLowerCase().includes(s)) ||
        (u.phone && u.phone.toLowerCase().includes(s))
      );
    }

    users.forEach(u => {
      delete u.password;
      delete u.refreshToken;
    });

    const total = users.length;
    const startIndex = (Number(page) - 1) * Number(limit);
    const paginated = users.slice(startIndex, startIndex + Number(limit));

    res.json({
      success: true,
      data: paginated,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
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
    const user = await findById(User, req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const updated = await User.update({ id: req.params.id }, { isVerified });
    delete updated.password;
    delete updated.refreshToken;

    res.json({ success: true, data: updated, message: 'User status updated' });
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

    const user = await findById(User, req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const updated = await User.update({ id: req.params.id }, { role });
    delete updated.password;
    delete updated.refreshToken;

    res.json({ success: true, data: updated, message: 'User role updated' });
  } catch (error) {
    next(error);
  }
};

// @desc  Delete user
// @route DELETE /api/admin/users/:id
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await findById(User, req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await User.delete(req.params.id);
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
    
    let products = await find(Product);

    if (status) {
      const s = status.toLowerCase();
      if (s === 'approved' || s === 'active') {
        products = products.filter(p => p.status === 'Active');
      } else if (s === 'pending' || s === 'pending review') {
        products = products.filter(p => p.status === 'Pending Review');
      } else if (s === 'rejected') {
        products = products.filter(p => p.status === 'Rejected');
      }
    }
    if (category && category.toLowerCase() !== 'all categories') {
      products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }
    if (search) {
      const s = search.toLowerCase();
      products = products.filter(p => p.name.toLowerCase().includes(s) || p.description.toLowerCase().includes(s));
    }

    const total = products.length;
    const totalAll = products.length;
    const totalApproved = products.filter(p => p.status === 'Active').length;
    const totalRejected = products.filter(p => p.status === 'Rejected').length;

    const startIndex = (Number(page) - 1) * Number(limit);
    const paginated = products.slice(startIndex, startIndex + Number(limit));

    const mappedProducts = await Promise.all(
      paginated.map(async (p) => {
        const obj = { ...p };
        const farmer = await findById(User, p.farmer);
        if (obj.status === 'Active') obj.status = 'Approved';
        else if (obj.status === 'Pending Review') obj.status = 'Pending';
        obj.quantity = obj.stock;
        obj.farmerName = farmer?.name || obj.farmerName || 'Unknown';
        obj.farmerEmail = farmer?.email || '';
        obj.farmerPhone = farmer?.phone || '';
        obj.image = obj.images?.[0] || '';
        obj.dateAdded = obj.createdAt;
        return obj;
      })
    );

    res.json({
      success: true,
      data: mappedProducts,
      counts: {
        all: totalAll,
        approved: totalApproved,
        rejected: totalRejected
      },
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
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

    const product = await findById(Product, req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const updated = await Product.update({ id: req.params.id }, { status });

    if (['Active', 'Rejected'].includes(status)) {
      const type = status === 'Active' ? 'product_approval' : 'product_rejection';
      const title = status === 'Active' ? 'Product Approved' : 'Product Rejected';
      const message = status === 'Active'
        ? `Your product "${product.name}" has been approved and is now active.`
        : `Your product is rejected, Product Name: ${product.name}. Reason: ${reason || 'No reason specified'}`;

      await Notification.create({
        recipient: product.farmer,
        type,
        title,
        message
      });
    }

    res.json({ success: true, data: updated, message: 'Product status updated' });
  } catch (error) {
    next(error);
  }
};

// @desc  Delete product
// @route DELETE /api/admin/products/:id
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await findById(Product, req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    await Product.delete(req.params.id);
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
    
    let orders = await find(Order);

    if (status) {
      const s = status.toLowerCase();
      orders = orders.filter(o => (o.status || '').toLowerCase() === s);
    }

    const total = orders.length;
    const deliveredCount = orders.filter(o => (o.status || '').toLowerCase() === 'delivered').length;
    const shippingCount = orders.filter(o => (o.status || '').toLowerCase() === 'shipped').length;
    const cancelledCount = orders.filter(o => (o.status || '').toLowerCase() === 'cancelled').length;
    const pendingCount = orders.filter(o => (o.status || '').toLowerCase() === 'pending').length;

    const revenue = orders
      .filter(o => (o.status || '').toLowerCase() === 'delivered')
      .reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    const startIndex = (Number(page) - 1) * Number(limit);
    const paginated = orders.slice(startIndex, startIndex + Number(limit));

    const populatedOrders = await Promise.all(
      paginated.map(async (order) => {
        const consumer = await findById(User, order.consumer);
        const items = await Promise.all(
          (order.items || []).map(async (item) => {
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
        return {
          ...order,
          consumer: consumer ? { id: consumer.id, name: consumer.name, email: consumer.email, phone: consumer.phone } : null,
          items
        };
      })
    );

    res.json({
      success: true,
      data: populatedOrders,
      counts: {
        delivered: deliveredCount,
        shipping: shippingCount,
        cancelled: cancelledCount,
        pending: pendingCount,
      },
      revenue,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
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

    const order = await findById(Order, req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const updated = await Order.update({ id: req.params.id }, { status });
    res.json({ success: true, data: updated, message: 'Order status updated' });
  } catch (error) {
    next(error);
  }
};

// @desc  Get reports and analytics
// @route GET /api/admin/reports
exports.getReports = async (req, res, next) => {
  try {
    const allProducts = await find(Product);
    const topProducts = allProducts.slice(0, 5);

    const allUsers = await find(User);
    const userGrowth = {};
    allUsers.forEach(user => {
      const month = new Date(user.createdAt || Date.now()).toLocaleString('default', { month: 'short', year: '2-digit' });
      userGrowth[month] = (userGrowth[month] || 0) + 1;
    });

    const orders = await find(Order);
    const revenueData = {};
    orders.forEach(order => {
      const month = new Date(order.createdAt || Date.now()).toLocaleString('default', { month: 'short', year: '2-digit' });
      revenueData[month] = (revenueData[month] || 0) + (order.totalAmount || 0);
    });

    const activeUsers = allUsers.filter(u => u.isVerified && (u.status || '').toLowerCase() !== 'disabled').length;
    const totalOrdersCount = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    res.json({
      success: true,
      data: {
        topProducts,
        userGrowth,
        revenueData,
        categoryBreakdown: [],
        stats: {
          activeUsers,
          productsSold: totalOrdersCount,
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
    const chats = await find(Chat);
    const totalQueries = chats.length;
    const avgResponseTime = totalQueries > 0 ? 250 : 0;
    const positiveReactions = Math.floor(totalQueries * 0.88);
    const negativeReactions = Math.floor(totalQueries * 0.02);

    res.json({
      success: true,
      data: {
        totalQueries,
        avgResponseTime,
        positiveReactions,
        negativeReactions,
        neutralReactions: totalQueries - positiveReactions - negativeReactions,
        sentimentAnalysis: {},
        recentActivity: chats.slice(-10).reverse(),
        modelHealth: {
          cpuUsage: 15,
          stability: 98,
          requestQueueStatus: 'Idle',
          queuePercentage: 0,
          uptimeHours: (process.uptime() / 3600).toFixed(1),
          primaryModel: 'Agri-Sage-LLM-Large'
        }
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
    const admin = await findById(User, req.user.id);
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    delete admin.password;
    delete admin.refreshToken;
    res.json({ success: true, data: admin });
  } catch (error) {
    next(error);
  }
};

// @desc  Update admin profile
// @route PUT /api/admin/profile
exports.updateAdminProfile = async (req, res, next) => {
  try {
    const { name, phone, address, avatar, location, bio, email, otp } = req.body;
    const currentAdmin = await findById(User, req.user.id);

    if (name) {
      if (/\d/.test(name)) {
        return res.status(400).json({ success: false, message: 'Name cannot contain numbers' });
      }
      if (!/^[a-zA-Z\s\.\-]+$/.test(name)) {
        return res.status(400).json({ success: false, message: 'Name can only contain alphabetic characters, spaces, dots, or hyphens' });
      }
    }

    let formattedPhone = currentAdmin.phone;
    if (phone) {
      formattedPhone = phone.trim().replace(/[\s\-\+\(\)]/g, ''); 
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '94' + formattedPhone.slice(1);
      } else if (!formattedPhone.startsWith('94') && formattedPhone.length === 9) {
        formattedPhone = '94' + formattedPhone;
      }
    }

    if (formattedPhone && formattedPhone !== currentAdmin.phone) {
      if (!otp) {
        return res.status(400).json({ success: false, message: 'OTP is required to change phone number' });
      }

      const existingPhone = await findOne(User, 'phone', formattedPhone);
      if (existingPhone && existingPhone.id !== currentAdmin.id) {
        return res.status(400).json({ success: false, message: 'Phone number already registered' });
      }

      const record = await findOne(OtpVerification, 'phone', formattedPhone);
      if (!record || record.otp !== otp) {
        return res.status(400).json({ success: false, message: 'Invalid or expired verification OTP' });
      }

      await deleteMany(OtpVerification, { phone: formattedPhone });
    }

    let avatarUrl = avatar;
    if (avatar) {
      avatarUrl = await uploadBase64ToS3(avatar, 'avatars');
    }

    const updateData = { 
      name, 
      phone: formattedPhone, 
      address, 
      avatar: avatarUrl, 
      location, 
      bio 
    };
    
    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== req.user.email) {
        const emailExists = await findOne(User, 'email', normalizedEmail);
        if (emailExists && emailExists.id !== req.user.id) {
          return res.status(400).json({ success: false, message: 'Email address is already in use by another account' });
        }
        updateData.email = normalizedEmail;
      }
    }

    const admin = await User.update({ id: req.user.id }, updateData);
    delete admin.password;
    delete admin.refreshToken;

    res.json({ success: true, data: admin, message: 'Profile updated successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc  Get admin activity logs (real data from DB)
// @route GET /api/admin/activity-logs
exports.getActivityLogs = async (req, res, next) => {
  try {
    const recentUsers = await find(User);
    const recentOrders = await find(Order);
    const recentProducts = await find(Product);

    const activities = [];

    recentUsers.slice(0, 4).forEach(u => {
      activities.push({
        type: 'user_registered',
        action: `New ${u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : 'User'} Registered`,
        target: u.name || u.email || 'Unknown User',
        detail: u.email || '',
        timestamp: u.createdAt || Date.now(),
      });
    });

    recentOrders.slice(0, 4).forEach(o => {
      activities.push({
        type: 'order',
        action: 'Order Placed',
        target: `Order #${(o.id || o._id || '000000').slice(-6).toUpperCase()}`,
        detail: `Amount: Rs.${(o.totalAmount || 0).toLocaleString()}`,
        timestamp: o.createdAt || Date.now(),
      });
    });

    recentProducts.slice(0, 4).forEach(p => {
      activities.push({
        type: 'product',
        action: 'Product Added',
        target: p.name || 'Unknown Product',
        detail: `Status: ${p.status || 'Pending'}`,
        timestamp: p.createdAt || Date.now(),
      });
    });

    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ success: true, data: activities.slice(0, 8) });
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

    const existingCard = await findOne(FarmerCard, 'cardNumber', cardNumber.trim());
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
    const cards = await find(FarmerCard);
    res.json({ success: true, data: cards });
  } catch (error) {
    next(error);
  }
};
