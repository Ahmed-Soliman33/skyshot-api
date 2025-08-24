const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: [true, 'faq.question_required'],
      trim: true,
      maxlength: [200, 'faq.question_too_long'],
    },
    answer: {
      type: String,
      required: [true, 'faq.answer_required'],
      trim: true,
      maxlength: [2000, 'faq.answer_too_long'],
    },
    category: {
      type: String,
      required: [true, 'faq.category_required'],
      enum: {
        values: ['general', 'pricing', 'services', 'booking', 'technical', 'payment', 'delivery'],
        message: 'faq.category_invalid',
      },
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive', 'archived'],
        message: 'faq.status_invalid',
      },
      default: 'active',
    },
    featured: {
      type: Boolean,
      default: false,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    language: {
      type: String,
      enum: {
        values: ['en', 'ar'],
        message: 'faq.language_invalid',
      },
      default: 'en',
    },
    translations: {
      en: {
        question: String,
        answer: String,
      },
      ar: {
        question: String,
        answer: String,
      },
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: [30, 'faq.tag_too_long'],
      },
    ],
    relatedServices: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
      },
    ],
    helpfulCount: {
      type: Number,
      default: 0,
      min: [0, 'faq.helpful_count_negative'],
    },
    notHelpfulCount: {
      type: Number,
      default: 0,
      min: [0, 'faq.not_helpful_count_negative'],
    },
    views: {
      type: Number,
      default: 0,
      min: [0, 'faq.views_negative'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'faq.created_by_required'],
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    seo: {
      metaTitle: {
        type: String,
        trim: true,
        maxlength: [60, 'faq.meta_title_too_long'],
      },
      metaDescription: {
        type: String,
        trim: true,
        maxlength: [160, 'faq.meta_description_too_long'],
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for helpfulness ratio
faqSchema.virtual('helpfulnessRatio').get(function () {
  const total = this.helpfulCount + this.notHelpfulCount;
  if (total === 0) return 0;
  return (this.helpfulCount / total) * 100;
});

// Virtual for short answer
faqSchema.virtual('shortAnswer').get(function () {
  if (!this.answer) return '';
  return this.answer.length > 150 
    ? this.answer.substring(0, 147) + '...' 
    : this.answer;
});

// Indexes for better performance
faqSchema.index({ status: 1, featured: 1, displayOrder: 1 });
faqSchema.index({ category: 1, status: 1 });
faqSchema.index({ language: 1, status: 1 });
faqSchema.index({ tags: 1, status: 1 });
faqSchema.index({ createdBy: 1, status: 1 });
faqSchema.index({ question: 'text', answer: 'text', tags: 'text' });

// Pre-save middleware
faqSchema.pre('save', function (next) {
  // Ensure tags are unique and clean
  if (this.tags && this.tags.length > 0) {
    this.tags = [...new Set(this.tags.filter(tag => tag.trim() !== ''))];
  }
  
  // Generate SEO meta title from question if not provided
  if (!this.seo.metaTitle && this.question) {
    this.seo.metaTitle = this.question.length > 60 
      ? this.question.substring(0, 57) + '...'
      : this.question;
  }
  
  // Generate SEO meta description from answer if not provided
  if (!this.seo.metaDescription && this.answer) {
    const plainText = this.answer.replace(/<[^>]*>/g, '');
    this.seo.metaDescription = plainText.length > 160 
      ? plainText.substring(0, 157) + '...'
      : plainText;
  }
  
  next();
});

// Static method to find active FAQs
faqSchema.statics.findActive = function (filters = {}) {
  return this.find({ status: 'active', ...filters })
    .populate('createdBy', 'firstName lastName')
    .populate('relatedServices', 'name slug')
    .sort({ featured: -1, displayOrder: 1, createdAt: -1 });
};

// Static method to find featured FAQs
faqSchema.statics.findFeatured = function (limit = 10) {
  return this.find({ status: 'active', featured: true })
    .populate('createdBy', 'firstName lastName')
    .sort({ displayOrder: 1, createdAt: -1 })
    .limit(limit);
};

// Static method to find by category
faqSchema.statics.findByCategory = function (category, language = 'en') {
  return this.find({ category, status: 'active', language })
    .populate('createdBy', 'firstName lastName')
    .populate('relatedServices', 'name slug')
    .sort({ featured: -1, displayOrder: 1, createdAt: -1 });
};

// Static method to search FAQs
faqSchema.statics.searchFAQs = function (query, filters = {}) {
  const searchQuery = {
    $text: { $search: query },
    status: 'active',
    ...filters,
  };
  
  return this.find(searchQuery, { score: { $meta: 'textScore' } })
    .populate('createdBy', 'firstName lastName')
    .sort({ score: { $meta: 'textScore' } });
};

// Static method to get popular FAQs
faqSchema.statics.findPopular = function (limit = 10) {
  return this.find({ status: 'active' })
    .populate('createdBy', 'firstName lastName')
    .sort({ views: -1, helpfulCount: -1 })
    .limit(limit);
};

// Instance method to increment views
faqSchema.methods.incrementViews = function () {
  this.views += 1;
  return this.save({ validateBeforeSave: false });
};

// Instance method to mark as helpful
faqSchema.methods.markAsHelpful = function () {
  this.helpfulCount += 1;
  return this.save({ validateBeforeSave: false });
};

// Instance method to mark as not helpful
faqSchema.methods.markAsNotHelpful = function () {
  this.notHelpfulCount += 1;
  return this.save({ validateBeforeSave: false });
};

// Instance method to toggle featured status
faqSchema.methods.toggleFeatured = function () {
  this.featured = !this.featured;
  return this.save();
};

// Instance method to get localized content
faqSchema.methods.getLocalizedContent = function (language = 'en') {
  if (this.translations && this.translations[language]) {
    return {
      question: this.translations[language].question || this.question,
      answer: this.translations[language].answer || this.answer,
    };
  }
  
  return {
    question: this.question,
    answer: this.answer,
  };
};

const FAQ = mongoose.model('FAQ', faqSchema);

module.exports = FAQ;
