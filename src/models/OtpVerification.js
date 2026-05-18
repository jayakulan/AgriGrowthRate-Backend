const mongoose = require('mongoose');

const otpVerificationSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true },
    otp: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 600 }, // Auto-expires after 10 minutes (600 seconds)
  },
  { timestamps: true }
);

module.exports = mongoose.model('OtpVerification', otpVerificationSchema);
