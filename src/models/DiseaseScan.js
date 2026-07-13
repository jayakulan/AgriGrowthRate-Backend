const mongoose = require('mongoose');

const diseaseScanSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  crop: {
    type: String,
    required: true,
  },
  diseaseName: {
    type: String,
    required: true,
  },
  confidence: {
    type: Number,
    required: true,
  },
  treatment: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    default: 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?w=100&h=100&fit=crop'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('DiseaseScan', diseaseScanSchema);
