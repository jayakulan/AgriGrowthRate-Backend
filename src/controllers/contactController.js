const ContactMessage = require('../models/ContactMessage');

// @desc    Submit a contact message / inquiry
// @route   POST /api/contact
// @access  Public
exports.submitContactMessage = async (req, res, next) => {
  try {
    const { firstName, lastName, email, contactNo, message } = req.body;

    if (!firstName || !lastName || !email || !contactNo || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: firstName, lastName, email, contactNo, and message',
      });
    }

    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
      });
    }

    const contactMessage = await ContactMessage.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      contactNo: contactNo.trim(),
      message: message.trim(),
    });

    res.status(201).json({
      success: true,
      message: 'Your message has been sent successfully. We will get back to you soon!',
      data: contactMessage,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all contact messages (Admin)
// @route   GET /api/contact
// @access  Private (Admin only)
exports.getContactMessages = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) {
      filter.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await ContactMessage.countDocuments(filter);
    const messages = await ContactMessage.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      data: messages,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update contact message status
// @route   PATCH /api/contact/:id/status
// @access  Private (Admin only)
exports.updateMessageStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['unread', 'read', 'resolved'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Allowed values: unread, read, resolved',
      });
    }

    const message = await ContactMessage.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found',
      });
    }

    res.json({
      success: true,
      message: `Message status updated to ${status}`,
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete contact message
// @route   DELETE /api/contact/:id
// @access  Private (Admin only)
exports.deleteContactMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const message = await ContactMessage.findByIdAndDelete(id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found',
      });
    }

    res.json({
      success: true,
      message: 'Contact message deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
