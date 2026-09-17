const stripeService = require('../services/stripeService');
const User = require('../models/User');
const { findById } = require('../utils/dbHelpers');

// @desc Create a checkout session for subscription
// @route POST /api/subscriptions/create-checkout-session
exports.createSubscriptionCheckoutSession = async (req, res, next) => {
  try {
    const user = await findById(User, req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripeService.createCustomer(user.email, user.name);
      stripeCustomerId = customer.id;
      await User.update({ id: user.id }, { stripeCustomerId });
    }

    const amount = 10; // $10 per month subscription
    const successUrl = req.body.returnUrl ? `${req.body.returnUrl}?payment=success` : `${process.env.FRONTEND_URL.split(',')[0]}/dashboard?payment=success`;
    const cancelUrl = req.body.returnUrl ? `${req.body.returnUrl}?payment=cancel` : `${process.env.FRONTEND_URL.split(',')[0]}/dashboard?payment=cancel`;

    const session = await stripeService.createCheckoutSession(
      amount, 
      'usd', 
      successUrl, 
      cancelUrl, 
      user.email
    );

    res.json({
      success: true,
      url: session.url,
    });
  } catch (error) {
    next(error);
  }
};

// @desc Confirm payment and update subscription
// @route POST /api/subscriptions/confirm
exports.confirmSubscription = async (req, res, next) => {
  try {
    const user = await findById(User, req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const expiryTimestamp = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days from now

    await User.update({ id: user.id }, {
      isSubscribed: true,
      subscriptionExpiry: expiryTimestamp,
      freeChatCount: 4
    });

    res.json({ success: true, message: 'Subscription active for 1 month' });
  } catch (error) {
    next(error);
  }
};
