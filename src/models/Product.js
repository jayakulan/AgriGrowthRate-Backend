const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: ['vegetables', 'fruits', 'grains', 'dairy', 'herbs', 'other'],
      required: true,
    },
    images: [{ type: String }],
    isOrganic: { type: Boolean, default: false },
    stock: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: 'kg' },
    totalWeight: { type: Number, default: 0, min: 0 },
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, default: 0 },
    reviews: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        comment: String,
        rating: Number,
        date: { type: Date, default: Date.now },
      },
    ],
    isAvailable: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Pending Review', 'Rejected'],
      default: 'Pending Review',
    },
    harvestDate: { type: Date },
    location: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
