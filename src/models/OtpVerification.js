const { dynamoose } = require('../config/awsConfig');
const { v4: uuidv4 } = require('uuid');

const otpVerificationSchema = new dynamoose.Schema(
  {
    id: {
      type: String,
      hashKey: true,
      default: () => uuidv4()
    },
    phone: {
      type: String,
      required: true,
      index: {
        name: 'phoneOtpIndex',
        global: true
      }
    },
    otp: { type: String, required: true },
    expiresAt: { type: Number, default: () => Date.now() + 600000 } // 10 minutes from creation
  },
  { timestamps: true }
);

const OtpVerification = dynamoose.model('OtpVerification', otpVerificationSchema, {
  create: true,
  waitForActive: false
});

module.exports = OtpVerification;
