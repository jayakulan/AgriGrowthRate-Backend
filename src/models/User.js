const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      enum: ['farmer', 'consumer', 'admin'],
      default: 'consumer',
    },
    avatar: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    location: { type: String, default: '' },
    bio: { type: String, default: '' },
    favoriteFarmers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isVerified: { type: Boolean, default: false },
    farmerCardNo: { type: String, default: '' },
    refreshToken: { type: String, default: '' },
    freeChatCount: { type: Number, default: 4 }, // AI chat limits
    isSubscribed: { type: Boolean, default: false },
    subscriptionExpiry: { type: Date, default: null },
    stripeCustomerId: { type: String, default: '' },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
