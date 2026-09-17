const Notification = require('../models/Notification');
const { find, findById } = require('../utils/dbHelpers');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await find(Notification, { recipient: req.user.id });
    res.json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark notifications as read
// @route   PATCH /api/notifications/read
// @access  Private
exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.body;

    if (id) {
      const notif = await findById(Notification, id);
      if (notif && notif.recipient === req.user.id) {
        await Notification.update({ id }, { read: true });
      }
    } else {
      const notifications = await find(Notification, { recipient: req.user.id });
      for (const n of notifications) {
        if (!n.read) {
          await Notification.update({ id: n.id }, { read: true });
        }
      }
    }

    res.json({ success: true, message: 'Notifications updated' });
  } catch (error) {
    next(error);
  }
};
