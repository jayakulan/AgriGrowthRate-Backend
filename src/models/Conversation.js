const { dynamoose } = require('../config/awsConfig');
const { v4: uuidv4 } = require('uuid');

const conversationMessageSchema = new dynamoose.Schema({
  id: { type: String, default: () => uuidv4() },
  sender: { type: String, required: true },
  text: { type: String, required: true },
  isImage: { type: Boolean, default: false },
  imageSrc: { type: String, default: '' },
  isFile: { type: Boolean, default: false },
  fileName: { type: String, default: '' },
  fileSize: { type: String, default: '' },
  timestamp: { type: Number, default: () => Date.now() }
});

const conversationSchema = new dynamoose.Schema(
  {
    id: {
      type: String,
      hashKey: true,
      default: () => uuidv4()
    },
    participants: {
      type: Array,
      schema: [String],
      default: []
    },
    messages: {
      type: Array,
      schema: [conversationMessageSchema],
      default: []
    },
    order: { type: String, default: '' }
  },
  { timestamps: true }
);

const Conversation = dynamoose.model('Conversation', conversationSchema, {
  create: true,
  waitForActive: false
});

module.exports = Conversation;
