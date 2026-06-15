const mongoose = require('mongoose');

const knowledgeBaseSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['processing', 'active', 'failed'], default: 'processing' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('KnowledgeBase', knowledgeBaseSchema);
