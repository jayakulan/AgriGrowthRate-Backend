const { dynamoose } = require('../config/awsConfig');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const userSchema = new dynamoose.Schema(
  {
    id: {
      type: String,
      hashKey: true,
      default: () => uuidv4()
    },
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      index: {
        name: 'emailIndex',
        global: true
      }
    },
    password: { type: String, required: true },
    role: {
      type: String,
      default: 'consumer'
    },
    status: { type: String, default: 'Enabled' },
    avatar: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    location: { type: String, default: '' },
    bio: { type: String, default: '' },
    favoriteFarmers: {
      type: Array,
      schema: [String],
      default: []
    },
    isVerified: { type: Boolean, default: false },
    farmerCardNo: { type: String, default: '' },
    refreshToken: { type: String, default: '' },
    freeChatCount: { type: Number, default: 4 },
    isSubscribed: { type: Boolean, default: false },
    subscriptionExpiry: { type: Number, default: null },
    stripeCustomerId: { type: String, default: '' }
  },
  {
    timestamps: true
  }
);

const User = dynamoose.model('User', userSchema, {
  create: true,
  waitForActive: false
});

User.hashPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

User.prototype.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = User;
