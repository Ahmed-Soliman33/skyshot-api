const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: [true, 'order.order_number_required'],
      unique: true,
      trim: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'order.customer_required'],
    },
    items: [
      {
        upload: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Upload',
          required: [true, 'order.upload_required'],
        },
        price: {
          type: Number,
          required: [true, 'order.price_required'],
          min: [0, 'order.price_negative'],
        },
        downloadUrl: {
          type: String,
          required: [true, 'order.download_url_required'],
        },
        downloadExpires: {
          type: Date,
          required: [true, 'order.download_expires_required'],
        },
        downloaded: {
          type: Boolean,
          default: false,
        },
        downloadedAt: {
          type: Date,
          default: null,
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: [true, 'order.total_amount_required'],
      min: [0, 'order.total_amount_negative'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'paid', 'completed', 'cancelled', 'refunded'],
        message: 'order.status_invalid',
      },
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ['credit_card', 'paypal', 'bank_transfer', 'wallet'],
        message: 'order.payment_method_invalid',
      },
      required: [true, 'order.payment_method_required'],
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ['pending', 'processing', 'completed', 'failed', 'refunded'],
        message: 'order.payment_status_invalid',
      },
      default: 'pending',
    },
    paymentId: {
      type: String,
      trim: true,
    },
    paymentData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    billingAddress: {
      firstName: String,
      lastName: String,
      email: String,
      phone: String,
      address: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'order.notes_too_long'],
    },
    completedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [200, 'order.cancellation_reason_too_long'],
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: [0, 'order.refund_amount_negative'],
    },
    refundReason: {
      type: String,
      trim: true,
      maxlength: [200, 'order.refund_reason_too_long'],
    },
    refundedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for order total items count
orderSchema.virtual('itemsCount').get(function () {
  return this.items ? this.items.length : 0;
});

// Virtual for commission amount (platform fee)
orderSchema.virtual('commissionAmount').get(function () {
  const commissionRate = 0.15; // 15% - should come from settings
  return this.totalAmount * commissionRate;
});

// Virtual for seller earnings
orderSchema.virtual('sellerEarnings').get(function () {
  return this.totalAmount - this.commissionAmount;
});

// Indexes for better performance
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ 'items.upload': 1 });

// Pre-save middleware to generate order number
orderSchema.pre('save', async function (next) {
  if (this.isNew && !this.orderNumber) {
    const count = await this.constructor.countDocuments();
    this.orderNumber = `ORD-${Date.now()}-${(count + 1).toString().padStart(4, '0')}`;
  }
  
  // Calculate total amount from items
  if (this.items && this.items.length > 0) {
    this.totalAmount = this.items.reduce((total, item) => total + item.price, 0);
  }
  
  // Set completion date when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  // Set cancellation date when status changes to cancelled
  if (this.isModified('status') && this.status === 'cancelled' && !this.cancelledAt) {
    this.cancelledAt = new Date();
  }
  
  next();
});

// Static method to generate download URL with expiration
orderSchema.statics.generateDownloadUrl = function (uploadId, orderId) {
  // In a real app, this would generate a secure signed URL
  const token = Buffer.from(`${uploadId}:${orderId}:${Date.now()}`).toString('base64');
  return `/api/downloads/${token}`;
};

// Static method to find orders by customer
orderSchema.statics.findByCustomer = function (customerId, options = {}) {
  const { page = 1, limit = 10, status = null } = options;
  const query = { customer: customerId };
  
  if (status) query.status = status;
  
  return this.find(query)
    .populate('items.upload', 'title thumbnailUrl fileType')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
};

// Instance method to mark as paid
orderSchema.methods.markAsPaid = function (paymentId, paymentData = {}) {
  this.status = 'paid';
  this.paymentStatus = 'completed';
  this.paymentId = paymentId;
  this.paymentData = paymentData;
  
  // Set download expiration for items (30 days from payment)
  const downloadExpires = new Date();
  downloadExpires.setDate(downloadExpires.getDate() + 30);
  
  this.items.forEach(item => {
    item.downloadUrl = this.constructor.generateDownloadUrl(item.upload, this._id);
    item.downloadExpires = downloadExpires;
  });
  
  return this.save();
};

// Instance method to cancel order
orderSchema.methods.cancel = function (reason) {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  return this.save();
};

// Instance method to process refund
orderSchema.methods.processRefund = function (amount, reason) {
  this.status = 'refunded';
  this.paymentStatus = 'refunded';
  this.refundAmount = amount || this.totalAmount;
  this.refundReason = reason;
  this.refundedAt = new Date();
  return this.save();
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
