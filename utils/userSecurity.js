const User = require("../models/User");
const crypto = require("crypto");

/**
 * User Security Utilities
 * Collection of helper functions for user security
 */

class UserSecurity {
  /**
   * Secure login with IP and browser tracking
   * @param {string} email - Email address
   * @param {string} password - Password
   * @param {Object} request - Express request object
   * @returns {Object} User object or error
   */
  static async secureLogin(email, password, request) {
    try {
      const loginInfo = {
        ip: request.ip || request.connection.remoteAddress,
        userAgent: request.get("User-Agent") || "Unknown",
      };

      const user = await User.findByCredentials(email, password, loginInfo);

      // Check for suspicious activity
      if (user.checkSuspiciousActivity()) {
        console.warn(`Suspicious activity detected for user: ${user.email}`);
        // Additional alerts can be added here
      }

      return {
        success: true,
        user: user,
        message: "Login successful",
      };
    } catch (error) {
      return {
        success: false,
        user: null,
        message: error.message,
      };
    }
  }

  /**
   * Create secure password reset code
   * @param {string} email - Email address
   * @returns {Object} Operation result
   */
  static async createPasswordReset(email) {
    try {
      const user = await User.findOne({
        email: email.toLowerCase().trim(),
        active: true,
      });

      if (!user) {
        // Don't reveal whether email exists for security reasons
        return {
          success: true,
          message: "If the email exists, a reset code has been sent",
        };
      }

      const resetCode = user.createPasswordResetCode();
      await user.save();

      return {
        success: true,
        resetCode: resetCode, // Should be sent via email, not returned directly
        message: "Password reset code generated",
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to generate reset code",
      };
    }
  }

  /**
   * Verify password reset code
   * @param {string} email - Email address
   * @param {string} code - Sent code
   * @returns {Object} Verification result
   */
  static async verifyPasswordReset(email, code) {
    try {
      const user = await User.findOne({
        email: email.toLowerCase().trim(),
        active: true,
      }).select("+passwordResetCode +passwordResetExpires");

      if (!user || !user.verifyPasswordResetCode(code)) {
        return {
          success: false,
          message: "Invalid or expired reset code",
        };
      }

      // Mark that the code has been verified
      user.passwordResetVerified = true;
      await user.save();

      return {
        success: true,
        message: "Reset code verified successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to verify reset code",
      };
    }
  }

  /**
   * تغيير Password بعد Verify الكود
   * @param {string} email - Email address
   * @param {string} newPassword - Password الجديدة
   * @returns {Object} Operation result
   */
  static async resetPassword(email, newPassword) {
    try {
      const user = await User.findOne({
        email: email.toLowerCase().trim(),
        active: true,
      }).select("+passwordResetVerified +passwordResetExpires");

      if (
        !user ||
        !user.passwordResetVerified ||
        user.passwordResetExpires < Date.now()
      ) {
        return {
          success: false,
          message: "Reset code not verified or expired",
        };
      }

      // تغيير Password
      user.password = newPassword;
      user.passwordResetCode = undefined;
      user.passwordResetExpires = undefined;
      user.passwordResetVerified = false;

      // reset محاولات تسجيل الدخول
      user.loginAttempts = undefined;
      user.lockUntil = undefined;

      await user.save();

      return {
        success: true,
        message: "Password reset successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to reset password",
      };
    }
  }

  /**
   * Generate token Verify Email address
   * @param {string} userId - User ID
   * @returns {Object} Operation result
   */
  static async createEmailVerification(userId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      if (user.emailVerified) {
        return {
          success: false,
          message: "Email already verified",
        };
      }

      const verificationToken = user.createEmailVerificationToken();
      await user.save();

      return {
        success: true,
        verificationToken: verificationToken,
        message: "Email verification token generated",
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to generate verification token",
      };
    }
  }

  /**
   * Verify Email address
   * @param {string} userId - User ID
   * @param {string} token - Verification token
   * @returns {Object} Operation result
   */
  static async verifyEmail(userId, token) {
    try {
      const user = await User.findById(userId).select(
        "+emailVerificationToken"
      );

      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      if (user.emailVerified) {
        return {
          success: false,
          message: "Email already verified",
        };
      }

      if (!user.verifyEmailToken(token)) {
        return {
          success: false,
          message: "Invalid verification token",
        };
      }

      user.emailVerified = true;
      user.emailVerificationToken = undefined;
      await user.save();

      return {
        success: true,
        message: "Email verified successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to verify email",
      };
    }
  }

  /**
   * Get users with suspicious activity
   * @returns {Array} List of suspicious users
   */
  static async getSuspiciousUsers() {
    try {
      return await User.findSuspiciousUsers();
    } catch (error) {
      console.error("Failed to get suspicious users:", error);
      return [];
    }
  }

  /**
   * Cleanup accounts inactive
   * @param {number} daysInactive - Number of days to consider inactive
   * @returns {Object} Operation result
   */
  static async cleanupInactiveAccounts(daysInactive = 365) {
    try {
      const result = await User.cleanupInactiveAccounts(daysInactive);
      return {
        success: true,
        deactivatedCount: result.modifiedCount,
        message: `Deactivated ${result.modifiedCount} inactive accounts`,
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to cleanup inactive accounts",
      };
    }
  }

  /**
   * Security analysis Password
   * @param {string} password - Password للتحليل
   * @returns {Object} تحليل قوة Password
   */
  static analyzePasswordStrength(password) {
    const analysis = {
      score: 0,
      feedback: [],
      isStrong: false,
    };

    // طول Password
    if (password.length >= 8) {
      analysis.score += 20;
    } else {
      analysis.feedback.push("Password should be at least 8 characters long");
    }

    // حروف كبيرة
    if (/[A-Z]/.test(password)) {
      analysis.score += 20;
    } else {
      analysis.feedback.push("Password should contain uppercase letters");
    }

    // حروف صغيرة
    if (/[a-z]/.test(password)) {
      analysis.score += 20;
    } else {
      analysis.feedback.push("Password should contain lowercase letters");
    }

    // أرقام
    if (/\d/.test(password)) {
      analysis.score += 20;
    } else {
      analysis.feedback.push("Password should contain numbers");
    }

    // رموز خاصة
    if (/[@$!%*?&]/.test(password)) {
      analysis.score += 20;
    } else {
      analysis.feedback.push(
        "Password should contain special characters (@$!%*?&)"
      );
    }

    // طول إضافي
    if (password.length >= 12) {
      analysis.score += 10;
    }

    // تنوع الأحرف
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= password.length * 0.7) {
      analysis.score += 10;
    }

    analysis.isStrong = analysis.score >= 80;

    return analysis;
  }
}

module.exports = UserSecurity;
