const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'blog.title_required'],
      trim: true,
      maxlength: [100, 'blog.title_too_long'],
    },
    slug: {
      type: String,
      required: [true, 'blog.slug_required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9-]+$/, 'blog.slug_invalid'],
    },
    content: {
      type: String,
      required: [true, 'blog.content_required'],
    },
    excerpt: {
      type: String,
      trim: true,
      maxlength: [300, 'blog.excerpt_too_long'],
    },
    featuredImage: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'blog.category_required'],
      enum: {
        values: ['photography', 'videography', 'tutorials', 'news', 'tips', 'equipment', 'inspiration'],
        message: 'blog.category_invalid',
      },
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: [30, 'blog.tag_too_long'],
      },
    ],
    status: {
      type: String,
      enum: {
        values: ['draft', 'published', 'archived'],
        message: 'blog.status_invalid',
      },
      default: 'draft',
    },
    featured: {
      type: Boolean,
      default: false,
    },
    metaTitle: {
      type: String,
      trim: true,
      maxlength: [60, 'blog.meta_title_too_long'],
    },
    metaDescription: {
      type: String,
      trim: true,
      maxlength: [160, 'blog.meta_description_too_long'],
    },
    language: {
      type: String,
      enum: {
        values: ['en', 'ar'],
        message: 'blog.language_invalid',
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
      required: [true, 'blog.author_required'],
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
      min: [0, 'blog.views_negative'],
    },
    likes: {
      type: Number,
      default: 0,
      min: [0, 'blog.likes_negative'],
    },
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        content: {
          type: String,
          required: true,
          trim: true,
          maxlength: [500, 'blog.comment_too_long'],
        },
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending',
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for reading time (words per minute = 200)
blogSchema.virtual('readingTime').get(function () {
  if (!this.content) return 0;
  const wordCount = this.content.split(/\s+/).length;
  return Math.ceil(wordCount / 200);
});

// Virtual for URL
blogSchema.virtual('url').get(function () {
  return `/blog/${this.slug}`;
});

// Virtual for approved comments count
blogSchema.virtual('approvedCommentsCount').get(function () {
  return this.comments ? this.comments.filter(comment => comment.status === 'approved').length : 0;
});

// Indexes for better performance
blogSchema.index({ slug: 1 });
blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ category: 1, status: 1 });
blogSchema.index({ author: 1, status: 1 });
blogSchema.index({ featured: 1, status: 1 });
blogSchema.index({ tags: 1, status: 1 });
blogSchema.index({ language: 1, status: 1 });
blogSchema.index({ title: 'text', content: 'text', tags: 'text' });

// Pre-save middleware
blogSchema.pre('save', function (next) {
  // Generate slug from title if not provided
  if (!this.slug && this.title) {
    this.slug = this.title
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

// Static method to find published posts
blogSchema.statics.findPublished = function (filters = {}) {
  return this.find({ status: 'published', ...filters })
    .populate('author', 'firstName lastName avatar')
    .sort({ publishedAt: -1 });
};

// Static method to find featured posts
blogSchema.statics.findFeatured = function (limit = 5) {
  return this.find({ status: 'published', featured: true })
    .populate('author', 'firstName lastName avatar')
    .sort({ publishedAt: -1 })
    .limit(limit);
};

// Static method to find by category
blogSchema.statics.findByCategory = function (category, language = 'en') {
  return this.find({ category, status: 'published', language })
    .populate('author', 'firstName lastName avatar')
    .sort({ publishedAt: -1 });
};

// Static method to search posts
blogSchema.statics.searchPosts = function (query, filters = {}) {
  const searchQuery = {
    $text: { $search: query },
    status: 'published',
    ...filters,
  };
  
  return this.find(searchQuery, { score: { $meta: 'textScore' } })
    .populate('author', 'firstName lastName avatar')
    .sort({ score: { $meta: 'textScore' } });
};

// Instance method to increment views
blogSchema.methods.incrementViews = function () {
  this.views += 1;
  return this.save({ validateBeforeSave: false });
};

// Instance method to add comment
blogSchema.methods.addComment = function (userId, content) {
  this.comments.push({
    user: userId,
    content: content.trim(),
  });
  return this.save();
};

// Instance method to approve comment
blogSchema.methods.approveComment = function (commentId) {
  const comment = this.comments.id(commentId);
  if (comment) {
    comment.status = 'approved';
    return this.save();
  }
  throw new Error('blog.comment_not_found');
};

// Instance method to get localized content
blogSchema.methods.getLocalizedContent = function (language = 'en') {
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

const Blog = mongoose.model('Blog', blogSchema);

module.exports = Blog;
