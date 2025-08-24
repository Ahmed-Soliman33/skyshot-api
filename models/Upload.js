const mongoose = require("mongoose");

const uploadSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "upload.user_required"],
    },
    title: {
      type: String,
      required: [true, "upload.title_required"],
      trim: true,
      maxlength: [100, "upload.title_too_long"],
    },
    description: {
      type: String,
      required: [true, "upload.description_required"],
      trim: true,
      maxlength: [1000, "upload.description_too_long"],
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: [30, "upload.tag_too_long"],
      },
    ],
    category: {
      type: String,
      required: [true, "upload.category_required"],
      enum: {
        values: ["photography", "video", "graphics", "illustration", "other"],
        message: "upload.category_invalid",
      },
    },
    fileType: {
      type: String,
      required: [true, "upload.file_type_required"],
      enum: {
        values: ["image", "video"],
        message: "upload.file_type_invalid",
      },
    },
    originalFileUrl: {
      type: String,
      required: [true, "upload.original_file_required"],
    },
    watermarkedFileUrl: {
      type: String,
      required: [true, "upload.watermarked_file_required"],
    },
    thumbnailUrl: {
      type: String,
      required: [true, "upload.thumbnail_required"],
    },
    previewUrl: {
      type: String, // Low quality preview for public viewing
    },
    fileSize: {
      type: Number,
      required: [true, "upload.file_size_required"],
      min: [1, "upload.file_size_invalid"],
    },
    dimensions: {
      width: {
        type: Number,
        required: [true, "upload.width_required"],
      },
      height: {
        type: Number,
        required: [true, "upload.height_required"],
      },
    },
    duration: {
      type: Number, // For videos, in seconds
      default: null,
    },
    price: {
      type: Number,
      required: [true, "upload.price_required"],
      min: [0, "upload.price_negative"],
      default: 0,
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "approved", "rejected", "suspended"],
        message: "upload.status_invalid",
      },
      default: "pending",
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, "upload.rejection_reason_too_long"],
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    downloads: {
      type: Number,
      default: 0,
      min: [0, "upload.downloads_negative"],
    },
    views: {
      type: Number,
      default: 0,
      min: [0, "upload.views_negative"],
    },
    likes: {
      type: Number,
      default: 0,
      min: [0, "upload.likes_negative"],
    },
    featured: {
      type: Boolean,
      default: false,
    },
    revenue: {
      totalEarnings: {
        type: Number,
        default: 0,
        min: [0, "upload.total_earnings_negative"],
      },
      totalSales: {
        type: Number,
        default: 0,
        min: [0, "upload.total_sales_negative"],
      },
      lastSaleDate: {
        type: Date,
        default: null,
      },
    },
    metadata: {
      camera: String,
      lens: String,
      settings: String,
      location: String,
      software: String,
      exif: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for popularity score
uploadSchema.virtual("popularityScore").get(function () {
  return this.views * 0.1 + this.downloads * 2 + this.likes * 1.5;
});

// Virtual for earnings (if sold)
uploadSchema.virtual("earnings").get(function () {
  return this.downloads * this.price;
});

// Indexes for better performance
uploadSchema.index({ user: 1, status: 1 });
uploadSchema.index({ status: 1, createdAt: -1 });
uploadSchema.index({ category: 1, status: 1 });
uploadSchema.index({ tags: 1, status: 1 });
uploadSchema.index({ featured: 1, status: 1 });
uploadSchema.index({ title: "text", description: "text", tags: "text" });

// Pre-save middleware
uploadSchema.pre("save", function (next) {
  // Ensure tags are unique and clean
  if (this.tags && this.tags.length > 0) {
    this.tags = [...new Set(this.tags.filter((tag) => tag.trim() !== ""))];
  }

  // Set reviewedAt when status changes to approved/rejected
  if (
    this.isModified("status") &&
    ["approved", "rejected"].includes(this.status)
  ) {
    this.reviewedAt = new Date();
  }

  next();
});

// Static method to find approved uploads
uploadSchema.statics.findApproved = function (filters = {}) {
  return this.find({ status: "approved", ...filters });
};

// Static method to find pending uploads
uploadSchema.statics.findPending = function () {
  return this.find({ status: "pending" }).populate(
    "user",
    "firstName lastName email"
  );
};

// Static method to find by category
uploadSchema.statics.findByCategory = function (category) {
  return this.find({ category, status: "approved" });
};

// Static method to search uploads
uploadSchema.statics.searchUploads = function (query, filters = {}) {
  const searchQuery = {
    $text: { $search: query },
    status: "approved",
    ...filters,
  };

  return this.find(searchQuery, { score: { $meta: "textScore" } }).sort({
    score: { $meta: "textScore" },
  });
};

// Instance method to approve upload
uploadSchema.methods.approve = function (reviewerId) {
  this.status = "approved";
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  this.rejectionReason = undefined;
  return this.save();
};

// Instance method to reject upload
uploadSchema.methods.reject = function (reviewerId, reason) {
  this.status = "rejected";
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  this.rejectionReason = reason;
  return this.save();
};

// Instance method to increment views
uploadSchema.methods.incrementViews = function () {
  this.views += 1;
  return this.save({ validateBeforeSave: false });
};

// Instance method to increment downloads
uploadSchema.methods.incrementDownloads = function () {
  this.downloads += 1;
  return this.save({ validateBeforeSave: false });
};

// Instance method to record sale
uploadSchema.methods.recordSale = function (saleAmount) {
  this.revenue.totalSales += 1;
  this.revenue.totalEarnings += saleAmount;
  this.revenue.lastSaleDate = new Date();
  this.downloads += 1; // Also increment downloads
  return this.save({ validateBeforeSave: false });
};

const Upload = mongoose.model("Upload", uploadSchema);

module.exports = Upload;
