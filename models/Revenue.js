const mongoose = require('mongoose');

const revenueSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'revenue.user_required'],
    },
    type: {
      type: String,
      enum: {
        values: ['upload_sale', 'mission_payment', 'commission', 'bonus', 'refund', 'withdrawal'],
        message: 'revenue.type_invalid',
      },
      required: [true, 'revenue.type_required'],
    },
    amount: {
      type: Number,
      required: [true, 'revenue.amount_required'],
      min: [0, 'revenue.amount_negative'],
    },
    currency: {
      type: String,
      default: 'SAR',
      enum: ['SAR', 'USD', 'EUR'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'completed', 'cancelled', 'failed'],
        message: 'revenue.status_invalid',
      },
      default: 'pending',
    },
    description: {
      type: String,
      required: [true, 'revenue.description_required'],
      trim: true,
      maxlength: [200, 'revenue.description_too_long'],
    },
    relatedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    relatedMission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mission',
    },
    relatedUpload: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Upload',
    },
    commission: {
      rate: {
        type: Number,
        min: [0, 'revenue.commission_rate_negative'],
        max: [1, 'revenue.commission_rate_too_high'],
      },
      amount: {
        type: Number,
        min: [0, 'revenue.commission_amount_negative'],
      },
    },
    platformFee: {
      rate: {
        type: Number,
        min: [0, 'revenue.platform_fee_rate_negative'],
        max: [1, 'revenue.platform_fee_rate_too_high'],
      },
      amount: {
        type: Number,
        min: [0, 'revenue.platform_fee_amount_negative'],
      },
    },
    netAmount: {
      type: Number,
      required: [true, 'revenue.net_amount_required'],
      min: [0, 'revenue.net_amount_negative'],
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ['bank_transfer', 'paypal', 'stripe', 'wallet', 'cash'],
        message: 'revenue.payment_method_invalid',
      },
    },
    paymentDetails: {
      transactionId: String,
      paymentGateway: String,
      gatewayResponse: mongoose.Schema.Types.Mixed,
    },
    processedAt: {
      type: Date,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'revenue.notes_too_long'],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for formatted amount
revenueSchema.virtual('formattedAmount').get(function () {
  return `${this.amount.toFixed(2)} ${this.currency}`;
});

// Virtual for formatted net amount
revenueSchema.virtual('formattedNetAmount').get(function () {
  return `${this.netAmount.toFixed(2)} ${this.currency}`;
});

// Virtual for is withdrawal
revenueSchema.virtual('isWithdrawal').get(function () {
  return this.type === 'withdrawal';
});

// Virtual for is earning
revenueSchema.virtual('isEarning').get(function () {
  return ['upload_sale', 'mission_payment', 'bonus'].includes(this.type);
});

// Indexes for better performance
revenueSchema.index({ user: 1, createdAt: -1 });
revenueSchema.index({ type: 1, status: 1 });
revenueSchema.index({ status: 1, createdAt: -1 });
revenueSchema.index({ relatedOrder: 1 });
revenueSchema.index({ relatedMission: 1 });
revenueSchema.index({ relatedUpload: 1 });
revenueSchema.index({ processedAt: -1 });

// Pre-save middleware
revenueSchema.pre('save', function (next) {
  // Calculate net amount if not provided
  if (!this.netAmount || this.isModified('amount') || this.isModified('commission') || this.isModified('platformFee')) {
    let netAmount = this.amount;
    
    // Subtract commission
    if (this.commission && this.commission.amount) {
      netAmount -= this.commission.amount;
    } else if (this.commission && this.commission.rate) {
      const commissionAmount = this.amount * this.commission.rate;
      this.commission.amount = commissionAmount;
      netAmount -= commissionAmount;
    }
    
    // Subtract platform fee
    if (this.platformFee && this.platformFee.amount) {
      netAmount -= this.platformFee.amount;
    } else if (this.platformFee && this.platformFee.rate) {
      const platformFeeAmount = this.amount * this.platformFee.rate;
      this.platformFee.amount = platformFeeAmount;
      netAmount -= platformFeeAmount;
    }
    
    this.netAmount = Math.max(0, netAmount);
  }
  
  // Set processed date when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.processedAt) {
    this.processedAt = new Date();
  }
  
  next();
});

// Static method to create upload sale revenue
revenueSchema.statics.createUploadSaleRevenue = async function (order, upload, seller) {
  const Settings = mongoose.model('Settings');
  const commissionRate = await Settings.getSetting('commission_rate') || 0.15;
  
  const item = order.items.find(item => item.upload.toString() === upload._id.toString());
  if (!item) throw new Error('revenue.upload_not_in_order');
  
  const revenue = new this({
    user: seller._id,
    type: 'upload_sale',
    amount: item.price,
    description: `Sale of "${upload.title}" to ${order.customer.firstName} ${order.customer.lastName}`,
    relatedOrder: order._id,
    relatedUpload: upload._id,
    commission: {
      rate: commissionRate,
      amount: item.price * commissionRate,
    },
    status: 'completed',
  });
  
  return revenue.save();
};

// Static method to create mission payment revenue
revenueSchema.statics.createMissionPaymentRevenue = async function (mission, partner) {
  const revenue = new this({
    user: partner._id,
    type: 'mission_payment',
    amount: mission.finalBudget,
    description: `Payment for mission: ${mission.title}`,
    relatedMission: mission._id,
    status: 'pending', // Requires manual approval
  });
  
  return revenue.save();
};

// Static method to get user earnings summary
revenueSchema.statics.getUserEarningsSummary = async function (userId, dateRange = {}) {
  const { startDate, endDate } = dateRange;
  const matchQuery = { 
    user: userId,
    status: 'completed',
    type: { $in: ['upload_sale', 'mission_payment', 'bonus'] }
  };
  
  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
    if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
  }
  
  const summary = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalEarnings: { $sum: '$netAmount' },
        totalGross: { $sum: '$amount' },
        totalCommission: { $sum: '$commission.amount' },
        totalTransactions: { $sum: 1 },
        byType: {
          $push: {
            type: '$type',
            amount: '$netAmount',
            gross: '$amount',
          }
        }
      }
    }
  ]);
  
  return summary[0] || {
    totalEarnings: 0,
    totalGross: 0,
    totalCommission: 0,
    totalTransactions: 0,
    byType: []
  };
};

// Static method to get platform revenue summary
revenueSchema.statics.getPlatformRevenueSummary = async function (dateRange = {}) {
  const { startDate, endDate } = dateRange;
  const matchQuery = { 
    status: 'completed',
    type: { $in: ['upload_sale', 'mission_payment'] }
  };
  
  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
    if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
  }
  
  const summary = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
        totalCommission: { $sum: '$commission.amount' },
        totalPlatformFees: { $sum: '$platformFee.amount' },
        totalPayouts: { $sum: '$netAmount' },
        totalTransactions: { $sum: 1 },
      }
    }
  ]);
  
  return summary[0] || {
    totalRevenue: 0,
    totalCommission: 0,
    totalPlatformFees: 0,
    totalPayouts: 0,
    totalTransactions: 0,
  };
};

// Instance method to process payment
revenueSchema.methods.processPayment = function (paymentMethod, paymentDetails, processedBy) {
  this.status = 'completed';
  this.paymentMethod = paymentMethod;
  this.paymentDetails = paymentDetails;
  this.processedAt = new Date();
  this.processedBy = processedBy;
  return this.save();
};

// Instance method to cancel
revenueSchema.methods.cancel = function (reason) {
  this.status = 'cancelled';
  this.notes = reason;
  return this.save();
};

const Revenue = mongoose.model('Revenue', revenueSchema);

module.exports = Revenue;
