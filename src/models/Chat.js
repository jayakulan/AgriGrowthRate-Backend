const { dynamoose } = require('../config/awsConfig');
const { v4: uuidv4 } = require('uuid');

const chatMessageSchema = new dynamoose.Schema({
  id: { type: String, default: () => uuidv4() },
  role: { type: String, required: true },
  content: { type: String, required: true },
  timestamp: { type: Number, default: () => Date.now() }
});

const chatSchema = new dynamoose.Schema(
  {
    id: {
      type: String,
      hashKey: true,
      default: () => uuidv4()
    },
    user: {
      type: String,
      required: true,
      index: {
        name: 'userChatIndex',
        global: true
      }
    },
    title: { type: String, default: 'New Chat' },
    messages: {
      type: Array,
      schema: [chatMessageSchema],
      default: []
    },
    context: { type: String, default: 'general' }
  },
  { timestamps: true }
);

const Chat = dynamoose.model('Chat', chatSchema, {
  create: true,
  waitForActive: false
});

module.exports = Chat;
