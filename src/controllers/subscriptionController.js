const stripeService = require('../services/stripeService');
const User = require('../models/User');

// @desc Create a checkout session for subscription
// @route POST /api/subscriptions/create-checkout-session
exports.createSubscriptionCheckoutSession = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    // If user doesn't have a Stripe customer ID, we might create one
    if (!user.stripeCustomerId) {
      const customer = await stripeService.createCustomer(user.email, user.name);
      user.stripeCustomerId = customer.id;
      await user.save();
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
    const user = await User.findById(req.user._id);
    
    // Set subscription details
    user.isSubscribed = true;
    
    // Set expiry to 1 month from now
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1);
    user.subscriptionExpiry = expiry;

    // Reset free chats (though if subscribed it doesn't matter, but good practice)
    user.freeChatCount = 4;
    
    await user.save();

    res.json({ success: true, message: 'Subscription active for 1 month' });
  } catch (error) {
    next(error);
  }
};
