const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema(
  {
    consumerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Favorite', favoriteSchema);
