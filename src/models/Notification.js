const { dynamoose } = require('../config/awsConfig');
const { v4: uuidv4 } = require('uuid');

const notificationSchema = new dynamoose.Schema(
  {
    id: {
      type: String,
      hashKey: true,
      default: () => uuidv4()
    },
    recipient: {
      type: String,
      required: true,
      index: {
        name: 'recipientIndex',
        global: true
      }
    },
    type: { type: String, default: 'other' },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);

const Notification = dynamoose.model('Notification', notificationSchema, {
  create: true,
  waitForActive: false
});

module.exports = Notification;
