const { dynamoose } = require('../config/awsConfig');
const { v4: uuidv4 } = require('uuid');

const contactMessageSchema = new dynamoose.Schema(
  {
    id: {
      type: String,
      hashKey: true,
      default: () => uuidv4()
    },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    contactNo: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      default: 'unread'
    }
  },
  { timestamps: true }
);

const ContactMessage = dynamoose.model('ContactMessage', contactMessageSchema, {
  create: true,
  waitForActive: false
});

module.exports = ContactMessage;
