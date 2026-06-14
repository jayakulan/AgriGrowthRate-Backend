const express = require('express');
const router = express.Router();
const { createSubscriptionCheckoutSession, confirmSubscription } = require('../controllers/subscriptionController');
const { protect } = require('../middleware/authMiddleware');

router.post('/create-checkout-session', protect, createSubscriptionCheckoutSession);
router.post('/confirm', protect, confirmSubscription);

module.exports = router;
