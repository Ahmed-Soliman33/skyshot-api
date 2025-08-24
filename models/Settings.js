const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'settings.key_required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'settings.value_required'],
    },
    type: {
      type: String,
      enum: {
        values: ['string', 'number', 'boolean', 'object', 'array'],
        message: 'settings.type_invalid',
      },
      required: [true, 'settings.type_required'],
    },
    category: {
      type: String,
      enum: {
        values: ['general', 'ui', 'payment', 'upload', 'notification', 'security'],
        message: 'settings.category_invalid',
      },
      required: [true, 'settings.category_required'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'settings.description_too_long'],
    },
    isPublic: {
      type: Boolean,
      default: false, // Whether this setting can be accessed by frontend
    },
    isEditable: {
      type: Boolean,
      default: true, // Whether this setting can be modified
    },
    validation: {
      min: Number,
      max: Number,
      pattern: String,
      options: [String], // For enum-like values
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
settingsSchema.index({ key: 1 });
settingsSchema.index({ category: 1, isPublic: 1 });

// Pre-save middleware for validation
settingsSchema.pre('save', function (next) {
  // Validate value based on type
  switch (this.type) {
    case 'number':
      if (typeof this.value !== 'number') {
        return next(new Error('settings.value_must_be_number'));
      }
      if (this.validation?.min !== undefined && this.value < this.validation.min) {
        return next(new Error('settings.value_below_minimum'));
      }
      if (this.validation?.max !== undefined && this.value > this.validation.max) {
        return next(new Error('settings.value_above_maximum'));
      }
      break;
      
    case 'boolean':
      if (typeof this.value !== 'boolean') {
        return next(new Error('settings.value_must_be_boolean'));
      }
      break;
      
    case 'string':
      if (typeof this.value !== 'string') {
        return next(new Error('settings.value_must_be_string'));
      }
      if (this.validation?.pattern) {
        const regex = new RegExp(this.validation.pattern);
        if (!regex.test(this.value)) {
          return next(new Error('settings.value_invalid_pattern'));
        }
      }
      if (this.validation?.options && !this.validation.options.includes(this.value)) {
        return next(new Error('settings.value_not_in_options'));
      }
      break;
  }
  
  next();
});

// Static method to get setting by key
settingsSchema.statics.getSetting = async function (key) {
  const setting = await this.findOne({ key });
  return setting ? setting.value : null;
};

// Static method to set setting
settingsSchema.statics.setSetting = async function (key, value, userId = null) {
  const setting = await this.findOneAndUpdate(
    { key },
    { 
      value, 
      lastModifiedBy: userId,
      updatedAt: new Date()
    },
    { 
      new: true, 
      upsert: true,
      runValidators: true
    }
  );
  
  return setting;
};

// Static method to get public settings
settingsSchema.statics.getPublicSettings = function () {
  return this.find({ isPublic: true }, 'key value type category description');
};

// Static method to get settings by category
settingsSchema.statics.getByCategory = function (category, includePrivate = false) {
  const query = { category };
  if (!includePrivate) {
    query.isPublic = true;
  }
  
  return this.find(query);
};

// Static method to initialize default settings
settingsSchema.statics.initializeDefaults = async function () {
  const defaultSettings = [
    // General Settings
    {
      key: 'site_name',
      value: 'SkyShot',
      type: 'string',
      category: 'general',
      description: 'Website name',
      isPublic: true,
    },
    {
      key: 'site_description',
      value: 'Professional photography and video marketplace',
      type: 'string',
      category: 'general',
      description: 'Website description',
      isPublic: true,
    },
    {
      key: 'contact_email',
      value: 'contact@skyshot.com',
      type: 'string',
      category: 'general',
      description: 'Contact email address',
      isPublic: true,
    },
    
    // Upload Settings
    {
      key: 'max_file_size',
      value: 50, // MB
      type: 'number',
      category: 'upload',
      description: 'Maximum file size in MB',
      validation: { min: 1, max: 500 },
    },
    {
      key: 'allowed_file_types',
      value: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov', 'avi'],
      type: 'array',
      category: 'upload',
      description: 'Allowed file extensions',
    },
    {
      key: 'auto_approve_uploads',
      value: false,
      type: 'boolean',
      category: 'upload',
      description: 'Automatically approve uploads without review',
    },
    
    // UI Settings
    {
      key: 'items_per_page',
      value: 20,
      type: 'number',
      category: 'ui',
      description: 'Default items per page',
      isPublic: true,
      validation: { min: 5, max: 100 },
    },
    {
      key: 'featured_items_count',
      value: 8,
      type: 'number',
      category: 'ui',
      description: 'Number of featured items to show',
      isPublic: true,
      validation: { min: 1, max: 20 },
    },
    
    // Payment Settings
    {
      key: 'commission_rate',
      value: 0.15, // 15%
      type: 'number',
      category: 'payment',
      description: 'Platform commission rate (0-1)',
      validation: { min: 0, max: 1 },
    },
    {
      key: 'minimum_payout',
      value: 50,
      type: 'number',
      category: 'payment',
      description: 'Minimum amount for payout request',
      validation: { min: 1 },
    },
    
    // Security Settings
    {
      key: 'jwt_expires_in',
      value: '7d',
      type: 'string',
      category: 'security',
      description: 'JWT token expiration time',
    },
    {
      key: 'max_login_attempts',
      value: 5,
      type: 'number',
      category: 'security',
      description: 'Maximum login attempts before lockout',
      validation: { min: 1, max: 10 },
    },
  ];

  for (const setting of defaultSettings) {
    await this.findOneAndUpdate(
      { key: setting.key },
      setting,
      { upsert: true, new: true }
    );
  }
};

// Instance method to update value
settingsSchema.methods.updateValue = function (newValue, userId = null) {
  this.value = newValue;
  this.lastModifiedBy = userId;
  this.updatedAt = new Date();
  return this.save();
};

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
