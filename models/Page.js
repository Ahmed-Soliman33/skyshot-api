const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'page.title_required'],
      trim: true,
      maxlength: [100, 'page.title_too_long'],
    },
    slug: {
      type: String,
      required: [true, 'page.slug_required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9-]+$/, 'page.slug_invalid'],
    },
    content: {
      type: String,
      required: [true, 'page.content_required'],
    },
    excerpt: {
      type: String,
      trim: true,
      maxlength: [300, 'page.excerpt_too_long'],
    },
    metaTitle: {
      type: String,
      trim: true,
      maxlength: [60, 'page.meta_title_too_long'],
    },
    metaDescription: {
      type: String,
      trim: true,
      maxlength: [160, 'page.meta_description_too_long'],
    },
    featuredImage: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'published', 'archived'],
        message: 'page.status_invalid',
      },
      default: 'draft',
    },
    isHomepage: {
      type: Boolean,
      default: false,
    },
    showInMenu: {
      type: Boolean,
      default: true,
    },
    menuOrder: {
      type: Number,
      default: 0,
    },
    template: {
      type: String,
      enum: {
        values: ['default', 'landing', 'contact', 'about', 'services'],
        message: 'page.template_invalid',
      },
      default: 'default',
    },
    language: {
      type: String,
      enum: {
        values: ['en', 'ar'],
        message: 'page.language_invalid',
      },
      default: 'en',
    },
    translations: {
      en: {
        title: String,
        content: String,
        excerpt: String,
        metaTitle: String,
        metaDescription: String,
      },
      ar: {
        title: String,
        content: String,
        excerpt: String,
        metaTitle: String,
        metaDescription: String,
      },
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'page.author_required'],
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    views: {
      type: Number,
      default: 0,
      min: [0, 'page.views_negative'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for reading time (words per minute = 200)
pageSchema.virtual('readingTime').get(function () {
  if (!this.content) return 0;
  const wordCount = this.content.split(/\s+/).length;
  return Math.ceil(wordCount / 200);
});

// Virtual for URL
pageSchema.virtual('url').get(function () {
  return `/${this.slug}`;
});

// Indexes for better performance
pageSchema.index({ slug: 1 });
pageSchema.index({ status: 1, publishedAt: -1 });
pageSchema.index({ author: 1, status: 1 });
pageSchema.index({ showInMenu: 1, menuOrder: 1 });
pageSchema.index({ language: 1, status: 1 });
pageSchema.index({ title: 'text', content: 'text' });

// Pre-save middleware
pageSchema.pre('save', function (next) {
  // Generate slug from title if not provided
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }
  
  // Set published date when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  // Generate meta title from title if not provided
  if (!this.metaTitle && this.title) {
    this.metaTitle = this.title;
  }
  
  // Generate excerpt from content if not provided
  if (!this.excerpt && this.content) {
    const plainText = this.content.replace(/<[^>]*>/g, '');
    this.excerpt = plainText.substring(0, 297) + (plainText.length > 297 ? '...' : '');
  }
  
  next();
});

// Ensure only one homepage
pageSchema.pre('save', async function (next) {
  if (this.isHomepage && this.isModified('isHomepage')) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { isHomepage: false }
    );
  }
  next();
});

// Static method to find published pages
pageSchema.statics.findPublished = function (language = 'en') {
  return this.find({ status: 'published', language })
    .populate('author', 'firstName lastName')
    .sort({ publishedAt: -1 });
};

// Static method to find menu pages
pageSchema.statics.findMenuPages = function (language = 'en') {
  return this.find({ 
    status: 'published', 
    showInMenu: true,
    language 
  })
    .sort({ menuOrder: 1, title: 1 });
};

// Static method to find homepage
pageSchema.statics.findHomepage = function (language = 'en') {
  return this.findOne({ 
    isHomepage: true, 
    status: 'published',
    language 
  });
};

// Instance method to increment views
pageSchema.methods.incrementViews = function () {
  this.views += 1;
  return this.save({ validateBeforeSave: false });
};

// Instance method to publish
pageSchema.methods.publish = function () {
  this.status = 'published';
  this.publishedAt = new Date();
  return this.save();
};

// Instance method to get localized content
pageSchema.methods.getLocalizedContent = function (language = 'en') {
  if (this.translations && this.translations[language]) {
    return {
      title: this.translations[language].title || this.title,
      content: this.translations[language].content || this.content,
      excerpt: this.translations[language].excerpt || this.excerpt,
      metaTitle: this.translations[language].metaTitle || this.metaTitle,
      metaDescription: this.translations[language].metaDescription || this.metaDescription,
    };
  }
  
  return {
    title: this.title,
    content: this.content,
    excerpt: this.excerpt,
    metaTitle: this.metaTitle,
    metaDescription: this.metaDescription,
  };
};

const Page = mongoose.model('Page', pageSchema);

module.exports = Page;
