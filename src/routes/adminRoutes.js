const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');

// Admin role check middleware
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
  }
  next();
};

// Analytics & Dashboard
router.get('/analytics', protect, adminOnly, adminController.getDashboardAnalytics);
router.get('/reports', protect, adminOnly, adminController.getReports);

// User Management
router.get('/users', protect, adminOnly, adminController.getAllUsers);
router.patch('/users/:id/status', protect, adminOnly, adminController.updateUserStatus);
router.patch('/users/:id/role', protect, adminOnly, adminController.updateUserRole);
router.delete('/users/:id', protect, adminOnly, adminController.deleteUser);

// Farmer Cards Management
router.post('/farmer-cards', protect, adminOnly, adminController.addFarmerCard);
router.get('/farmer-cards', protect, adminOnly, adminController.getFarmerCards);


// Product Management
router.get('/products', protect, adminOnly, adminController.getAllProducts);
router.patch('/products/:id/status', protect, adminOnly, adminController.updateProductStatus);
router.delete('/products/:id', protect, adminOnly, adminController.deleteProduct);

// Order Management
router.get('/orders', protect, adminOnly, adminController.getAllOrders);
router.patch('/orders/:id/status', protect, adminOnly, adminController.updateOrderStatus);

// AI Management
router.get('/ai-management', protect, adminOnly, adminController.getAIManagement);

// Admin Profile
router.get('/profile', protect, adminOnly, adminController.getAdminProfile);
router.put('/profile', protect, adminOnly, adminController.updateAdminProfile);
router.get('/activity-logs', protect, adminOnly, adminController.getActivityLogs);

module.exports = router;
