const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public route: submit contact message from landing page
router.post('/', contactController.submitContactMessage);

// Admin-only routes: view, update, delete contact inquiries
router.get('/', protect, authorize('admin'), contactController.getContactMessages);
router.patch('/:id/status', protect, authorize('admin'), contactController.updateMessageStatus);
router.delete('/:id', protect, authorize('admin'), contactController.deleteContactMessage);

module.exports = router;
