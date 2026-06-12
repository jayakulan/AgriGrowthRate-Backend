const mongoose = require('mongoose');

const farmerCardSchema = new mongoose.Schema(
  {
    cardNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    isRegistered: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FarmerCard', farmerCardSchema);
