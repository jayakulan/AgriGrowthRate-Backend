const Notification = require('../models/Notification');
const { find, findById } = require('../utils/dbHelpers');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res, next) => {
  try {
    let notifications = [];
    if (req.user.role === 'admin') {
      const allNotifs = await find(Notification);
      notifications = allNotifs.filter(
        n => n.recipient === req.user.id || n.recipient === 'admin'
      );
    } else {
      notifications = await find(Notification, { recipient: req.user.id });
    }

    // Sort descending by createdAt (newest first)
    notifications.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    const formatted = notifications.map(n => {
      const obj = typeof n.toJSON === 'function' ? n.toJSON() : { ...n };
      const keyId = obj.id || obj._id;
      return {
        ...obj,
        id: keyId,
        _id: keyId
      };
    });

    res.json({ success: true, data: formatted });
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
      if (notif) {
        const canMark =
          notif.recipient === req.user.id ||
          (req.user.role === 'admin' && notif.recipient === 'admin');
        if (canMark) {
          await Notification.update({ id }, { read: true });
        }
      }
    } else {
      let notifications = [];
      if (req.user.role === 'admin') {
        const allNotifs = await find(Notification);
        notifications = allNotifs.filter(
          n => n.recipient === req.user.id || n.recipient === 'admin'
        );
      } else {
        notifications = await find(Notification, { recipient: req.user.id });
      }

      for (const n of notifications) {
        if (!n.read) {
          const keyId = n.id || n._id;
          if (keyId) {
            await Notification.update({ id: keyId }, { read: true });
          }
        }
      }
    }

    res.json({ success: true, message: 'Notifications updated' });
  } catch (error) {
    next(error);
  }
};

