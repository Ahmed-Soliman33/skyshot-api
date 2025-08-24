const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const validator = require("validator");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First Name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
      validate: {
        validator: function (v) {
          // Allow English and Arabic letters plus spaces
          return /^[a-zA-Z\u0600-\u06FF\s]+$/.test(v);
        },
        message: "First name can only contain letters and spaces",
      },
    },
    lastName: {
      type: String,
      required: [true, "Last Name is required"],
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
      validate: {
        validator: function (v) {
          // Allow English and Arabic letters plus spaces
          return /^[a-zA-Z\u0600-\u06FF\s]+$/.test(v);
        },
        message: "Last name can only contain letters and spaces",
      },
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [100, "Email cannot exceed 100 characters"],
      validate: {
        validator: function (v) {
          return validator.isEmail(v);
        },
        message: "Please provide a valid email address",
      },
    },
    password: {
      type: String,
      required: function () {
        return this.authProvider === "local" || !this.authProvider;
      },
      minlength: [8, "Password must be at least 8 characters long"],
      maxlength: [128, "Password cannot exceed 128 characters"],
      validate: {
        validator: function (v) {
          // Strong password: at least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(
            v
          );
        },
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      },
    },
    role: {
      type: String,
      enum: {
        values: ["user", "partner", "admin", "master"],
        message: "Role must be one of: user, partner, admin, master",
      },
      default: "user",
    },
    phone: {
      type: String,
      validate: {
        validator: function (v) {
          return !v || validator.isMobilePhone(v);
        },
        message: "Please provide a valid phone number",
      },
      maxlength: [20, "Phone number cannot exceed 20 characters"],
    },
    country: {
      type: String,
      maxlength: [100, "Country name cannot exceed 100 characters"],
      validate: {
        validator: function (v) {
          // Allow English and Arabic letters plus spaces
          return !v || /^[a-zA-Z\u0600-\u06FF\s]+$/.test(v);
        },
        message: "Country name can only contain letters and spaces",
      },
    },
    birthDate: {
      type: Date,
      validate: {
        validator: function (v) {
          if (!v) return true;
          const today = new Date();
          const minAge = new Date(
            today.getFullYear() - 13,
            today.getMonth(),
            today.getDate()
          );
          const maxAge = new Date(
            today.getFullYear() - 80,
            today.getMonth(),
            today.getDate()
          );
          return v <= minAge && v >= maxAge;
        },
        message: "Age must be between 13 and 80 years",
      },
    },
    active: {
      type: Boolean,
      default: true,
    },
    refreshToken: {
      type: String,
    },
    passwordChangedAt: {
      type: Date,
    },
    passwordResetCode: {
      type: String,
    },
    passwordResetExpires: {
      type: Date,
    },
    passwordResetVerified: {
      type: Boolean,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
    },
    // Security audit fields
    lastLoginAt: {
      type: Date,
    },
    lastLogoutAt: {
      type: Date,
    },
    lastLoginIP: {
      type: String,
      validate: {
        validator: function (v) {
          return !v || validator.isIP(v);
        },
        message: "Invalid IP address format",
      },
    },
    loginHistory: [
      {
        ip: {
          type: String,
          validate: {
            validator: function (v) {
              return validator.isIP(v);
            },
            message: "Invalid IP address format",
          },
        },
        userAgent: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        success: {
          type: Boolean,
          default: true,
        },
      },
    ],
    // Account security flags
    suspiciousActivity: {
      type: Boolean,
      default: false,
    },
    // Privacy settings
    profileVisibility: {
      type: String,
      enum: ["public", "private", "friends"],
      default: "public",
    },
    googleId: {
      type: String,
      sparse: true, // يسمح بقيم null متعددة
      index: true,
    },

    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    avatar: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    // Add indexes for better performance and security
    indexes: [
      { email: 1 },
      { refreshToken: 1 },
      { passwordResetCode: 1 },
      { emailVerificationToken: 1 },
      { suspiciousActivity: 1 },
      { active: 1 },
    ],
  }
);

// Virtual for account lock status
userSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash the password and set passwordChangedAt
userSchema.pre("save", async function (next) {
  try {
    // Only hash password if it's modified
    if (!this.isModified("password")) {
      return next();
    }

    // Set passwordChangedAt if password is being changed (not for new users)
    if (!this.isNew) {
      this.passwordChangedAt = Date.now() - 1000; // Subtract 1 second to ensure JWT is created after password change
    }

    // Hash the password with higher cost factor for better security
    this.password = await bcrypt.hash(this.password, 14);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to handle login attempts and account locking
userSchema.pre("save", function (next) {
  // If account is not locked and we're not modifying loginAttempts, continue
  if (!this.isModified("loginAttempts") && !this.isModified("lockUntil")) {
    return next();
  }

  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil <= Date.now()) {
    return this.updateOne(
      {
        $unset: {
          lockUntil: 1,
        },
        $set: {
          loginAttempts: 1,
        },
      },
      next
    );
  }

  // Otherwise we're incrementing
  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = {
      lockUntil: Date.now() + 2 * 60 * 60 * 1000, // 2 hours
    };
  }

  return this.updateOne(updates, next);
});

// Instance method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  // eslint-disable-next-line no-useless-catch
  try {
    // Don't allow comparison if account is locked
    if (this.isLocked) {
      throw new Error(
        "Account is temporarily locked due to too many failed login attempts"
      );
    }

    const isMatch = await bcrypt.compare(candidatePassword, this.password);

    // If password matches, reset login attempts
    if (isMatch && this.loginAttempts > 0) {
      const updates = {
        $unset: {
          loginAttempts: 1,
          lockUntil: 1,
        },
      };
      await this.updateOne(updates);
    }

    return isMatch;
  } catch (error) {
    throw error;
  }
};

// Instance method to increment login attempts
userSchema.methods.incLoginAttempts = function () {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil <= Date.now()) {
    return this.updateOne({
      $unset: {
        lockUntil: 1,
      },
      $set: {
        loginAttempts: 1,
      },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = {
      lockUntil: Date.now() + 2 * 60 * 60 * 1000, // 2 hours
    };
  }

  return this.updateOne(updates);
};

// Instance method to check if password was changed after JWT was issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Static method to find user by email with password (for login)
userSchema.statics.findByCredentials = async function (
  email,
  password,
  loginInfo = {}
) {
  const user = await this.findOne({
    email: email.toLowerCase().trim(),
    active: true,
  }).select("+password +loginAttempts +lockUntil +loginHistory");

  if (!user) {
    throw new Error("Invalid login credentials");
  }

  // Check if account is locked
  if (user.isLocked) {
    throw new Error(
      "Account is temporarily locked due to too many failed login attempts"
    );
  }

  const isMatch = await user.comparePassword(password);

  // Log login attempt
  const loginAttempt = {
    ip: loginInfo.ip,
    userAgent: loginInfo.userAgent,
    timestamp: new Date(),
    success: isMatch,
  };

  // Keep only last 10 login attempts
  if (user.loginHistory.length >= 10) {
    user.loginHistory = user.loginHistory.slice(-9);
  }
  user.loginHistory.push(loginAttempt);

  if (!isMatch) {
    // Increment login attempts
    await user.incLoginAttempts();
    await user.save();
    throw new Error("Invalid login credentials");
  }

  // Update last login info on successful login
  user.lastLoginAt = new Date();
  user.lastLoginIP = loginInfo.ip;
  await user.save();

  return user;
};

// Instance method to check for suspicious login patterns
userSchema.methods.checkSuspiciousActivity = function () {
  if (this.loginHistory.length < 3) return false;

  const recentLogins = this.loginHistory.slice(-5);
  const uniqueIPs = new Set(recentLogins.map((login) => login.ip));
  const timeWindow = 30 * 60 * 1000; // 30 minutes
  const now = Date.now();

  // Check for multiple IPs in short time
  if (uniqueIPs.size > 3) {
    const recentTime = recentLogins.filter(
      (login) => now - login.timestamp.getTime() < timeWindow
    );
    if (recentTime.length > 2) {
      return true;
    }
  }

  // Check for rapid login attempts
  const rapidAttempts = recentLogins.filter(
    (login) => now - login.timestamp.getTime() < 5 * 60 * 1000 // 5 minutes
  );
  if (rapidAttempts.length > 3) {
    return true;
  }

  return false;
};

// Instance method to generate secure password reset code
userSchema.methods.createPasswordResetCode = function () {
  const resetCode = crypto.randomBytes(32).toString("hex");

  this.passwordResetCode = crypto
    .createHash("sha256")
    .update(resetCode)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  this.passwordResetVerified = false;

  return resetCode;
};

// Instance method to verify password reset code
userSchema.methods.verifyPasswordResetCode = function (code) {
  const hashedCode = crypto.createHash("sha256").update(code).digest("hex");

  return (
    this.passwordResetCode === hashedCode &&
    this.passwordResetExpires > Date.now()
  );
};

// Instance method to clean expired tokens
userSchema.methods.cleanExpiredTokens = function () {
  const now = Date.now();

  // Clean password reset if expired
  if (this.passwordResetExpires && this.passwordResetExpires < now) {
    this.passwordResetCode = undefined;
    this.passwordResetExpires = undefined;
    this.passwordResetVerified = false;
  }

  // Clean old login history (keep only last 30 days)
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  this.loginHistory = this.loginHistory.filter(
    (login) => login.timestamp.getTime() > thirtyDaysAgo
  );
};

// Add text index for search functionality
userSchema.index({
  firstName: "text",
  lastName: "text",
  email: "text",
});

// Pre-save middleware to check for suspicious activity
userSchema.pre("save", function (next) {
  if (this.isModified("loginHistory") && this.checkSuspiciousActivity()) {
    this.suspiciousActivity = true;
  }
  next();
});

// Pre-save middleware to clean expired tokens
userSchema.pre("save", function (next) {
  this.cleanExpiredTokens();
  next();
});

// Static method to clean up inactive accounts
userSchema.statics.cleanupInactiveAccounts = async function (
  daysInactive = 365
) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

  return await this.updateMany(
    {
      lastLoginAt: { $lt: cutoffDate },
      active: true,
    },
    {
      $set: { active: false },
    }
  );
};

// Static method to find users with suspicious activity
userSchema.statics.findSuspiciousUsers = async function () {
  return await this.find({
    suspiciousActivity: true,
    active: true,
  }).select("firstName lastName email lastLoginAt lastLoginIP");
};

// Instance method to generate email verification token
userSchema.methods.createEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString("hex");

  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  return verificationToken;
};

// Instance method to verify email verification token
userSchema.methods.verifyEmailToken = function (token) {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  return this.emailVerificationToken === hashedToken;
};

// Instance method to sanitize user data for public display
userSchema.methods.getPublicProfile = function () {
  return {
    id: this._id,
    firstName: this.firstName,
    lastName: this.lastName,
    email: this.profileVisibility === "public" ? this.email : null,
    country: this.profileVisibility !== "private" ? this.country : null,
    createdAt: this.createdAt,
    emailVerified: this.emailVerified,
  };
};

// تحديث validation للـ password (اختياري للـ Google users)
userSchema.pre("save", function (next) {
  if (this.authProvider === "google" && !this.password) {
    // Google users don't need password
    return next();
  }

  // باقي password validation logic
  next();
});

// Ensure virtual fields are serialized
userSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    // Remove sensitive fields from JSON output
    delete ret.password;
    delete ret.refreshToken;
    delete ret.passwordResetCode;
    delete ret.passwordResetExpires;
    delete ret.passwordResetVerified;
    delete ret.passwordChangedAt;
    delete ret.loginAttempts;
    delete ret.lockUntil;
    delete ret.emailVerificationToken;
    delete ret.twoFactorSecret;
    delete ret.suspiciousActivity;
    delete ret.__v;
    return ret;
  },
});

// Add compound indexes for better query performance
userSchema.index({ email: 1, active: 1 });
userSchema.index({ role: 1, active: 1 });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model("User", userSchema);
