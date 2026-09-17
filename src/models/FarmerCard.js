const { dynamoose } = require('../config/awsConfig');
const { v4: uuidv4 } = require('uuid');

const farmerCardSchema = new dynamoose.Schema(
  {
    id: {
      type: String,
      hashKey: true,
      default: () => uuidv4()
    },
    cardNumber: {
      type: String,
      required: true,
      index: {
        name: 'cardNumberIndex',
        global: true
      }
    },
    isRegistered: { type: Boolean, default: false }
  },
  { timestamps: true }
);

const FarmerCard = dynamoose.model('FarmerCard', farmerCardSchema, {
  create: true,
  waitForActive: false
});

module.exports = FarmerCard;
