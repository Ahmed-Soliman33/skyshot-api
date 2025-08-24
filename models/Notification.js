const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'notification.user_required'],
    },
    title: {
      type: String,
      required: [true, 'notification.title_required'],
      trim: true,
      maxlength: [100, 'notification.title_too_long'],
    },
    message: {
      type: String,
      required: [true, 'notification.message_required'],
      trim: true,
      maxlength: [500, 'notification.message_too_long'],
    },
    type: {
      type: String,
      enum: {
        values: ['system', 'upload', 'payment', 'account', 'promotion'],
        message: 'notification.type_invalid',
      },
      required: [true, 'notification.type_required'],
    },
    priority: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high', 'urgent'],
        message: 'notification.priority_invalid',
      },
      default: 'medium',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    actionUrl: {
      type: String,
      trim: true,
    },
    actionText: {
      type: String,
      trim: true,
      maxlength: [50, 'notification.action_text_too_long'],
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    sentVia: [
      {
        type: String,
        enum: ['app', 'email', 'sms'],
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for checking if notification is expired
notificationSchema.virtual('isExpired').get(function () {
  return this.expiresAt && this.expiresAt < new Date();
});

// Virtual for time since creation
notificationSchema.virtual('timeAgo').get(function () {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
});

// Indexes for better performance
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ priority: 1, isRead: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware
notificationSchema.pre('save', function (next) {
  // Set readAt when isRead changes to true
  if (this.isModified('isRead') && this.isRead && !this.readAt) {
    this.readAt = new Date();
  }
  
  next();
});

// Static method to create notification
notificationSchema.statics.createNotification = async function (data) {
  const notification = new this(data);
  await notification.save();
  
  // Populate user data for real-time notifications
  await notification.populate('user', 'firstName lastName email');
  
  return notification;
};

// Static method to get unread count for user
notificationSchema.statics.getUnreadCount = function (userId) {
  return this.countDocuments({ user: userId, isRead: false });
};

// Static method to get notifications for user
notificationSchema.statics.getForUser = function (userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    type = null,
    isRead = null,
    priority = null,
  } = options;

  const query = { user: userId };
  
  if (type) query.type = type;
  if (isRead !== null) query.isRead = isRead;
  if (priority) query.priority = priority;

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('user', 'firstName lastName');
};

// Static method to mark all as read for user
notificationSchema.statics.markAllAsRead = function (userId) {
  return this.updateMany(
    { user: userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

// Static method to delete old notifications
notificationSchema.statics.deleteOldNotifications = function (daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    isRead: true,
  });
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = function () {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Instance method to check if user can see this notification
notificationSchema.methods.canUserSee = function (userId) {
  return this.user.toString() === userId.toString();
};

// Static method for bulk notifications
notificationSchema.statics.createBulkNotifications = async function (notifications) {
  return this.insertMany(notifications);
};

// Static method to create system notification for all users
notificationSchema.statics.createSystemNotificationForAll = async function (data) {
  const User = mongoose.model('User');
  const users = await User.find({ status: 'active' }, '_id');
  
  const notifications = users.map(user => ({
    ...data,
    user: user._id,
    type: 'system',
  }));
  
  return this.createBulkNotifications(notifications);
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
