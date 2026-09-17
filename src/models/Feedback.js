const { dynamoose } = require('../config/awsConfig');
const { v4: uuidv4 } = require('uuid');

const feedbackSchema = new dynamoose.Schema(
  {
    id: {
      type: String,
      hashKey: true,
      default: () => uuidv4()
    },
    order: { type: String, required: true },
    reviewer: { type: String, required: true },
    reviewee: { type: String, required: true },
    product: { type: String, default: '' },
    rating: { type: Number, required: true },
    comment: { type: String, required: true },
    reviewerRole: { type: String, required: true }
  },
  { timestamps: true }
);

const Feedback = dynamoose.model('Feedback', feedbackSchema, {
  create: true,
  waitForActive: false
});

module.exports = Feedback;
