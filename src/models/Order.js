const { dynamoose } = require('../config/awsConfig');
const { v4: uuidv4 } = require('uuid');

const orderItemSchema = new dynamoose.Schema({
  product: { type: String, required: true },
  productName: { type: String, default: '' },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true }
});

const shippingAddressSchema = new dynamoose.Schema({
  street: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  pincode: { type: String, default: '' },
  country: { type: String, default: 'Sri Lanka' }
});

const orderSchema = new dynamoose.Schema(
  {
    id: {
      type: String,
      hashKey: true,
      default: () => uuidv4()
    },
    consumer: {
      type: String,
      required: true,
      index: {
        name: 'consumerIndex',
        global: true
      }
    },
    items: {
      type: Array,
      schema: [orderItemSchema],
      default: []
    },
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      default: 'pending'
    },
    orderStatus: {
      type: String,
      default: 'Delivered'
    },
    paymentStatus: {
      type: String,
      default: 'pending'
    },
    paymentMethod: { type: String, default: 'cash' },
    shippingAddress: {
      type: Object,
      schema: shippingAddressSchema,
      default: {}
    },
    orderConfirmationNumber: { type: String, default: () => `ORD-${Date.now()}` },
    deliveredAt: { type: String, default: '' },
    isReviewedByConsumer: { type: Boolean, default: false },
    isReviewedByFarmer: { type: Boolean, default: false }
  },
  {
    timestamps: true
  }
);

const Order = dynamoose.model('Order', orderSchema, {
  create: true,
  waitForActive: false
});

module.exports = Order;
