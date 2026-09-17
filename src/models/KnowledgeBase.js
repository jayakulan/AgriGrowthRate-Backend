const { dynamoose } = require('../config/awsConfig');
const { v4: uuidv4 } = require('uuid');

const knowledgeBaseSchema = new dynamoose.Schema(
  {
    id: {
      type: String,
      hashKey: true,
      default: () => uuidv4()
    },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    uploadedBy: { type: String, required: true },
    s3Url: { type: String, default: '' },
    status: { type: String, default: 'processing' }
  },
  { timestamps: true }
);

const KnowledgeBase = dynamoose.model('KnowledgeBase', knowledgeBaseSchema, {
  create: true,
  waitForActive: false
});

module.exports = KnowledgeBase;
