const Notification = require('../models/Notification');

/**
 * Helper to safely create a notification in DynamoDB
 * @param {Object} params
 * @param {string} params.recipient - User ID or 'admin'
 * @param {string} params.type - 'order' | 'product' | 'product_approval' | 'product_submission' | 'user' | 'contact' | 'feedback' | 'system'
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification body text
 */
const sendNotification = async ({ recipient, type = 'other', title, message }) => {
  try {
    if (!recipient || !title || !message) {
      console.warn('sendNotification: missing recipient, title, or message', { recipient, title, message });
      return null;
    }

    const notif = await Notification.create({
      recipient,
      type,
      title,
      message,
      read: false
    });

    return notif;
  } catch (error) {
    console.error('Failed to create notification:', error.message);
    return null;
  }
};

module.exports = {
  sendNotification
};
