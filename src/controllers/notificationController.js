const Notification = require('../models/Notification');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 });
    
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
      // Mark specific notification as read
      await Notification.findOneAndUpdate(
        { _id: id, recipient: req.user._id },
        { read: true }
      );
    } else {
      // Mark all notifications as read for this user
      await Notification.updateMany(
        { recipient: req.user._id, read: false },
        { read: true }
      );
    }

    res.json({ success: true, message: 'Notifications updated' });
  } catch (error) {
    next(error);
  }
};
