const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reviewee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    reviewerRole: { type: String, enum: ['farmer', 'consumer'], required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Feedback', feedbackSchema);
