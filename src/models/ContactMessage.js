const mongoose = require('mongoose');

const contactMessageSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email address',
      ],
    },
    contactNo: {
      type: String,
      required: [true, 'Contact number is required'],
      trim: true,
      maxlength: [20, 'Contact number cannot exceed 20 characters'],
    },
    message: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    status: {
      type: String,
      enum: ['unread', 'read', 'resolved'],
      default: 'unread',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
