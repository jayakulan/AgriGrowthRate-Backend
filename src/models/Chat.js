const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const chatSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, default: 'New Chat' },
    messages: [messageSchema],
    context: { type: String, default: 'general' }, // general | crop-disease | weather | recommendation
  },
  { timestamps: true }
);

module.exports = mongoose.model('Chat', chatSchema);
