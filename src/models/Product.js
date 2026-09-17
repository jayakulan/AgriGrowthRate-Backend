const { dynamoose } = require('../config/awsConfig');
const { v4: uuidv4 } = require('uuid');

const reviewSchema = new dynamoose.Schema({
  id: { type: String, default: () => uuidv4() },
  userId: { type: String },
  userName: { type: String, default: '' },
  comment: { type: String, default: '' },
  rating: { type: Number, default: 5 },
  date: { type: Number, default: () => Date.now() }
});

const productSchema = new dynamoose.Schema(
  {
    id: {
      type: String,
      hashKey: true,
      default: () => uuidv4()
    },
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: {
      type: String,
      required: true,
      index: {
        name: 'categoryIndex',
        global: true
      }
    },
    images: {
      type: Array,
      schema: [String],
      default: []
    },
    isOrganic: { type: Boolean, default: false },
    stock: { type: Number, default: 0 },
    unit: { type: String, default: 'kg' },
    totalWeight: { type: Number, default: 0 },
    farmer: {
      type: String,
      required: true,
      index: {
        name: 'farmerIndex',
        global: true
      }
    },
    farmerName: { type: String, default: '' },
    rating: { type: Number, default: 0 },
    reviews: {
      type: Array,
      schema: [reviewSchema],
      default: []
    },
    isAvailable: { type: Boolean, default: true },
    status: {
      type: String,
      default: 'Pending Review'
    },
    approvalStatus: {
      type: String,
      default: 'Approved'
    },
    harvestDate: { type: String, default: '' },
    location: { type: String, default: '' }
  },
  {
    timestamps: true
  }
);

const Product = dynamoose.model('Product', productSchema, {
  create: true,
  waitForActive: false
});

module.exports = Product;
