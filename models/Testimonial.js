const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'testimonial.name_required'],
      trim: true,
      maxlength: [100, 'testimonial.name_too_long'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'testimonial.email_invalid',
      ],
    },
    company: {
      type: String,
      trim: true,
      maxlength: [100, 'testimonial.company_too_long'],
    },
    position: {
      type: String,
      trim: true,
      maxlength: [100, 'testimonial.position_too_long'],
    },
    content: {
      type: String,
      required: [true, 'testimonial.content_required'],
      trim: true,
      maxlength: [1000, 'testimonial.content_too_long'],
    },
    rating: {
      type: Number,
      required: [true, 'testimonial.rating_required'],
      min: [1, 'testimonial.rating_too_low'],
      max: [5, 'testimonial.rating_too_high'],
    },
    avatar: {
      type: String,
      trim: true,
    },
    serviceType: {
      type: String,
      enum: {
        values: ['photography', 'videography', 'drone', 'editing', 'consultation', 'general'],
        message: 'testimonial.service_type_invalid',
      },
      default: 'general',
    },
    projectType: {
      type: String,
      enum: {
        values: ['wedding', 'event', 'portrait', 'commercial', 'product', 'real_estate', 'aerial', 'other'],
        message: 'testimonial.project_type_invalid',
      },
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected', 'archived'],
        message: 'testimonial.status_invalid',
      },
      default: 'pending',
    },
    featured: {
      type: Boolean,
      default: false,
    },
    language: {
      type: String,
      enum: {
        values: ['en', 'ar'],
        message: 'testimonial.language_invalid',
      },
      default: 'en',
    },
    translations: {
      en: {
        content: String,
        name: String,
        company: String,
        position: String,
      },
      ar: {
        content: String,
        name: String,
        company: String,
        position: String,
      },
    },
    relatedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    relatedMission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mission',
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    approvedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [200, 'testimonial.rejection_reason_too_long'],
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: [30, 'testimonial.tag_too_long'],
      },
    ],
    metadata: {
      ipAddress: String,
      userAgent: String,
      source: {
        type: String,
        enum: ['website', 'email', 'admin', 'import'],
        default: 'website',
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for star rating display
testimonialSchema.virtual('starsDisplay').get(function () {
  return '★'.repeat(this.rating) + '☆'.repeat(5 - this.rating);
});

// Virtual for short content
testimonialSchema.virtual('shortContent').get(function () {
  if (!this.content) return '';
  return this.content.length > 150 
    ? this.content.substring(0, 147) + '...' 
    : this.content;
});

// Indexes for better performance
testimonialSchema.index({ status: 1, featured: 1, displayOrder: 1 });
testimonialSchema.index({ serviceType: 1, status: 1 });
testimonialSchema.index({ rating: 1, status: 1 });
testimonialSchema.index({ submittedBy: 1, status: 1 });
testimonialSchema.index({ language: 1, status: 1 });
testimonialSchema.index({ createdAt: -1 });
testimonialSchema.index({ name: 'text', content: 'text', company: 'text' });

// Pre-save middleware
testimonialSchema.pre('save', function (next) {
  // Ensure tags are unique and clean
  if (this.tags && this.tags.length > 0) {
    this.tags = [...new Set(this.tags.filter(tag => tag.trim() !== ''))];
  }
  
  // Set approval date when status changes to approved
  if (this.isModified('status') && this.status === 'approved' && !this.approvedAt) {
    this.approvedAt = new Date();
  }
  
  // Set review date when status changes from pending
  if (this.isModified('status') && this.status !== 'pending' && !this.reviewedAt) {
    this.reviewedAt = new Date();
  }
  
  next();
});

// Static method to find approved testimonials
testimonialSchema.statics.findApproved = function (filters = {}) {
  return this.find({ status: 'approved', ...filters })
    .populate('submittedBy', 'firstName lastName')
    .sort({ featured: -1, displayOrder: 1, createdAt: -1 });
};

// Static method to find featured testimonials
testimonialSchema.statics.findFeatured = function (limit = 6) {
  return this.find({ status: 'approved', featured: true })
    .populate('submittedBy', 'firstName lastName')
    .sort({ displayOrder: 1, createdAt: -1 })
    .limit(limit);
};

// Static method to find by service type
testimonialSchema.statics.findByServiceType = function (serviceType, language = 'en') {
  return this.find({ serviceType, status: 'approved', language })
    .populate('submittedBy', 'firstName lastName')
    .sort({ featured: -1, displayOrder: 1, createdAt: -1 });
};

// Static method to find by rating
testimonialSchema.statics.findByRating = function (minRating = 4) {
  return this.find({ 
    status: 'approved', 
    rating: { $gte: minRating } 
  })
    .populate('submittedBy', 'firstName lastName')
    .sort({ rating: -1, featured: -1, createdAt: -1 });
};

// Static method to get average rating
testimonialSchema.statics.getAverageRating = function (filters = {}) {
  return this.aggregate([
    { $match: { status: 'approved', ...filters } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalCount: { $sum: 1 },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    }
  ]);
};

// Instance method to approve
testimonialSchema.methods.approve = function (reviewerId) {
  this.status = 'approved';
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  this.approvedAt = new Date();
  this.rejectionReason = undefined;
  return this.save();
};

// Instance method to reject
testimonialSchema.methods.reject = function (reviewerId, reason) {
  this.status = 'rejected';
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  this.rejectionReason = reason;
  this.approvedAt = undefined;
  return this.save();
};

// Instance method to feature/unfeature
testimonialSchema.methods.toggleFeatured = function () {
  this.featured = !this.featured;
  return this.save();
};

// Instance method to get localized content
testimonialSchema.methods.getLocalizedContent = function (language = 'en') {
  if (this.translations && this.translations[language]) {
    return {
      content: this.translations[language].content || this.content,
      name: this.translations[language].name || this.name,
      company: this.translations[language].company || this.company,
      position: this.translations[language].position || this.position,
    };
  }
  
  return {
    content: this.content,
    name: this.name,
    company: this.company,
    position: this.position,
  };
};

const Testimonial = mongoose.model('Testimonial', testimonialSchema);

module.exports = Testimonial;
