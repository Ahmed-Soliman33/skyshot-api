const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'service.name_required'],
      trim: true,
      maxlength: [100, 'service.name_too_long'],
    },
    slug: {
      type: String,
      required: [true, 'service.slug_required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9-]+$/, 'service.slug_invalid'],
    },
    description: {
      type: String,
      required: [true, 'service.description_required'],
      trim: true,
      maxlength: [2000, 'service.description_too_long'],
    },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: [200, 'service.short_description_too_long'],
    },
    category: {
      type: String,
      required: [true, 'service.category_required'],
      enum: {
        values: ['photography', 'videography', 'drone', 'editing', 'consultation'],
        message: 'service.category_invalid',
      },
    },
    type: {
      type: String,
      required: [true, 'service.type_required'],
      enum: {
        values: ['wedding', 'event', 'portrait', 'commercial', 'product', 'real_estate', 'aerial'],
        message: 'service.type_invalid',
      },
    },
    pricing: {
      type: {
        type: String,
        enum: ['fixed', 'hourly', 'package', 'custom'],
        default: 'fixed',
      },
      basePrice: {
        type: Number,
        required: [true, 'service.base_price_required'],
        min: [0, 'service.base_price_negative'],
      },
      currency: {
        type: String,
        default: 'SAR',
        enum: ['SAR', 'USD', 'EUR'],
      },
      packages: [
        {
          name: {
            type: String,
            required: true,
            trim: true,
          },
          description: {
            type: String,
            trim: true,
          },
          price: {
            type: Number,
            required: true,
            min: [0, 'service.package_price_negative'],
          },
          features: [String],
          duration: Number, // in hours
          deliverables: [String],
        },
      ],
    },
    features: [
      {
        type: String,
        trim: true,
        maxlength: [100, 'service.feature_too_long'],
      },
    ],
    deliverables: [
      {
        type: String,
        trim: true,
        maxlength: [100, 'service.deliverable_too_long'],
      },
    ],
    duration: {
      min: {
        type: Number,
        min: [0.5, 'service.duration_too_short'],
      },
      max: {
        type: Number,
        max: [24, 'service.duration_too_long'],
      },
      unit: {
        type: String,
        enum: ['hours', 'days'],
        default: 'hours',
      },
    },
    availability: {
      locations: [
        {
          type: String,
          trim: true,
        },
      ],
      travelRadius: {
        type: Number, // in kilometers
        default: 50,
        min: [0, 'service.travel_radius_negative'],
      },
      workingDays: [
        {
          type: String,
          enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        },
      ],
      advanceBooking: {
        type: Number, // minimum days in advance
        default: 7,
        min: [1, 'service.advance_booking_too_short'],
      },
    },
    portfolio: [
      {
        title: String,
        imageUrl: String,
        description: String,
      },
    ],
    equipment: [
      {
        type: String,
        trim: true,
        maxlength: [100, 'service.equipment_too_long'],
      },
    ],
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive', 'archived'],
        message: 'service.status_invalid',
      },
      default: 'active',
    },
    featured: {
      type: Boolean,
      default: false,
    },
    language: {
      type: String,
      enum: {
        values: ['en', 'ar'],
        message: 'service.language_invalid',
      },
      default: 'en',
    },
    translations: {
      en: {
        name: String,
        description: String,
        shortDescription: String,
        features: [String],
        deliverables: [String],
      },
      ar: {
        name: String,
        description: String,
        shortDescription: String,
        features: [String],
        deliverables: [String],
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'service.created_by_required'],
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: [30, 'service.tag_too_long'],
      },
    ],
    seo: {
      metaTitle: {
        type: String,
        trim: true,
        maxlength: [60, 'service.meta_title_too_long'],
      },
      metaDescription: {
        type: String,
        trim: true,
        maxlength: [160, 'service.meta_description_too_long'],
      },
    },
    stats: {
      views: {
        type: Number,
        default: 0,
        min: [0, 'service.views_negative'],
      },
      inquiries: {
        type: Number,
        default: 0,
        min: [0, 'service.inquiries_negative'],
      },
      bookings: {
        type: Number,
        default: 0,
        min: [0, 'service.bookings_negative'],
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for URL
serviceSchema.virtual('url').get(function () {
  return `/services/${this.slug}`;
});

// Virtual for price range
serviceSchema.virtual('priceRange').get(function () {
  if (this.pricing.packages && this.pricing.packages.length > 0) {
    const prices = this.pricing.packages.map(pkg => pkg.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return { min, max };
  }
  return { min: this.pricing.basePrice, max: this.pricing.basePrice };
});

// Indexes for better performance
serviceSchema.index({ slug: 1 });
serviceSchema.index({ status: 1, featured: 1 });
serviceSchema.index({ category: 1, status: 1 });
serviceSchema.index({ type: 1, status: 1 });
serviceSchema.index({ createdBy: 1, status: 1 });
serviceSchema.index({ tags: 1, status: 1 });
serviceSchema.index({ language: 1, status: 1 });
serviceSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Pre-save middleware
serviceSchema.pre('save', function (next) {
  // Generate slug from name if not provided
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }
  
  // Ensure tags are unique and clean
  if (this.tags && this.tags.length > 0) {
    this.tags = [...new Set(this.tags.filter(tag => tag.trim() !== ''))];
  }
  
  // Generate short description from description if not provided
  if (!this.shortDescription && this.description) {
    const plainText = this.description.replace(/<[^>]*>/g, '');
    this.shortDescription = plainText.substring(0, 197) + (plainText.length > 197 ? '...' : '');
  }
  
  // Generate SEO meta title from name if not provided
  if (!this.seo.metaTitle && this.name) {
    this.seo.metaTitle = this.name;
  }
  
  next();
});

// Static method to find active services
serviceSchema.statics.findActive = function (filters = {}) {
  return this.find({ status: 'active', ...filters })
    .populate('createdBy', 'firstName lastName')
    .sort({ featured: -1, createdAt: -1 });
};

// Static method to find featured services
serviceSchema.statics.findFeatured = function (limit = 6) {
  return this.find({ status: 'active', featured: true })
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to find by category
serviceSchema.statics.findByCategory = function (category, language = 'en') {
  return this.find({ category, status: 'active', language })
    .populate('createdBy', 'firstName lastName')
    .sort({ featured: -1, createdAt: -1 });
};

// Instance method to increment views
serviceSchema.methods.incrementViews = function () {
  this.stats.views += 1;
  return this.save({ validateBeforeSave: false });
};

// Instance method to increment inquiries
serviceSchema.methods.incrementInquiries = function () {
  this.stats.inquiries += 1;
  return this.save({ validateBeforeSave: false });
};

// Instance method to get localized content
serviceSchema.methods.getLocalizedContent = function (language = 'en') {
  if (this.translations && this.translations[language]) {
    return {
      name: this.translations[language].name || this.name,
      description: this.translations[language].description || this.description,
      shortDescription: this.translations[language].shortDescription || this.shortDescription,
      features: this.translations[language].features || this.features,
      deliverables: this.translations[language].deliverables || this.deliverables,
    };
  }
  
  return {
    name: this.name,
    description: this.description,
    shortDescription: this.shortDescription,
    features: this.features,
    deliverables: this.deliverables,
  };
};

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;
