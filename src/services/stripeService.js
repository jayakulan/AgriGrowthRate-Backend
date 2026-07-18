const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock_key'); // Use mock key if not provided

const createCheckoutSession = async (amount, currency = 'usd', successUrl, cancelUrl, customerEmail) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: 'Agri-Growth Rate Subscription',
              description: '1 month unlimited access to the Agriculture AI Assistant',
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail,
    });
    return session;
  } catch (error) {
    console.warn('Error creating checkout session (Returning mock URL):', error.message);
    return { url: successUrl };
  }
};

const createCustomer = async (email, name) => {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
    });
    return customer;
  } catch (error) {
    console.warn('Error creating customer (Returning mock ID):', error.message);
    return { id: 'cus_mock_' + Date.now() };
  }
};

module.exports = {
  createCheckoutSession,
  createCustomer,
};
