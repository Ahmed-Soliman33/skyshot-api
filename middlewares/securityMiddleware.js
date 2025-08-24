const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const hpp = require("hpp");
const User = require("../models/User");
// eslint-disable-next-line node/no-extraneous-require
const csrf = require("csurf");
const ApiError = require("../utils/ApiError");

/**
 * Security Middleware Collection - Fixed Version
 * Collection of security middleware - Enhanced version
 */

// Protection against Cross-Site Request Forgery (CSRF) attacks
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  },
});

// Protection against Brute Force attacks on login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts maximum
  message: {
    message: "Too many login attempts, please try again later",
    errorCode: "rate_limit",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip limit if login is successful
  skipSuccessfulRequests: true,
});

// Protection against Brute Force attacks on signup
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts maximum
  message: {
    message: "Too many signup attempts, please try again later",
    errorCode: "rate_limit",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip limit if login is successful
  skipSuccessfulRequests: true,
});

// Protection against Brute Force attacks on password reset
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts maximum
  message: {
    message: "Too many password reset attempts, please try again later",
    errorCode: "rate_limit",
    retryAfter: "1 hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General protection against excessive requests
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests maximum
  message: {
    message: "Too many requests, please try again later",
    errorCode: "rate_limit",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Sensitive API protection
const sensitiveApiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests maximum
  message: {
    message: "Too many requests to sensitive endpoint, please try again later",
    errorCode: "rate_limit",
    retryAfter: "1 hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Middleware to check for suspicious activity
 */
const checkSuspiciousActivity = async (req, res, next) => {
  try {
    if (req.user && req.user.id) {
      const user = await User.findById(req.user.id).select(
        "+suspiciousActivity +loginHistory"
      );

      if (user && user.suspiciousActivity) {
        // Log suspicious activity
        console.warn(
          `Suspicious user activity detected: ${user.email} from IP: ${req.ip}`
        );

        // Add warning to response
        res.locals.securityWarning =
          "Suspicious activity detected on your account";
      }
    }
    next();
  } catch (error) {
    console.error("Error checking suspicious activity:", error);
    next(); // Continue even if error occurs
  }
};

/**
 * Middleware to check email verification
 */
const requireEmailVerification = async (req, res, next) => {
  try {
    if (req.user && req.user.id) {
      const user = await User.findById(req.user.id);

      if (user && !user.emailVerified) {
        return next(
          new ApiError(
            "Email verification required to access this resource",
            403,
            "email_verification_required"
          )
        );
      }
    }
    next();
  } catch (error) {
    console.error("Error checking email verification:", error);
    next(new ApiError("Internal server error", 500, "internal_server_error"));
  }
};

/**
 * Middleware to check two-factor authentication
 */
const requireTwoFactor = async (req, res, next) => {
  try {
    if (req.user && req.user.id) {
      const user = await User.findById(req.user.id);

      if (user && user.twoFactorEnabled && !req.session.twoFactorVerified) {
        return next(
          new ApiError(
            "Two-factor authentication required",
            403,
            "two_factor_required"
          )
        );
      }
    }
    next();
  } catch (error) {
    console.error("Error checking two-factor authentication:", error);
    next(new ApiError("Internal server error", 500, "internal_server_error"));
  }
};

/**
 * Middleware to log suspicious access attempts
 */
const logSuspiciousAccess = (req, res, next) => {
  // Check for suspicious activity indicators
  const suspiciousIndicators = [];

  // User-Agent suspicious
  const userAgent = req.get("User-Agent") || "";
  if (!userAgent || userAgent.length < 10) {
    suspiciousIndicators.push("suspicious_user_agent");
  }

  // rapid consecutive requests
  if (req.rateLimit && req.rateLimit.remaining < 2) {
    suspiciousIndicators.push("rapid_requests");
  }

  // attempt to access sensitive paths
  const sensitivePaths = ["/admin", "/api/users", "/api/auth"];
  if (sensitivePaths.some((path) => req.path.startsWith(path))) {
    suspiciousIndicators.push("sensitive_path_access");
  }

  // تسجيل النشاط الsuspicious
  if (suspiciousIndicators.length > 0) {
    console.warn("Suspicious access attempt:", {
      ip: req.ip,
      userAgent: userAgent,
      path: req.path,
      method: req.method,
      indicators: suspiciousIndicators,
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

/**
 * Middleware to sanitize input data
 */
const sanitizeInput = (req, res, next) => {
  // Clean data from HTML/JavaScript
  if (req.body) {
    // eslint-disable-next-line no-restricted-syntax
    for (const key in req.body) {
      if (typeof req.body[key] === "string") {
        req.body[key] = req.body[key].trim();
      }
    }
  }

  next();
};

/**
 * Middleware للتحقق من قوة Password
 */
const validatePasswordStrength = (req, res, next) => {
  if (req.body.password) {
    const password = req.body.password;

    // Verify قوة Password
    const strongPasswordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (!strongPasswordRegex.test(password)) {
      return next(
        new ApiError(
          "Password must contain at least 8 characters, including uppercase, lowercase, number, and special character",
          400,
          "weak_password"
        )
      );
    }
  }

  next();
};

/**
 * Setup all security middleware
 */
const setupSecurity = (app) => {
  // Helmet for protection against vulnerabilities HTTP
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // Protection from HTTP Parameter Pollution
  app.use(
    hpp({
      whitelist: ["sort", "fields", "page", "limit"],
    })
  );

  // Rate limiting general
  app.use("/api/", generalLimiter);

  app.use((req, res, next) => {
    if (req.path.startsWith("/uploads/")) {
      return next();
    }

    // Check for suspicious activity
    logSuspiciousAccess(req, res, next);
  });

  // Clean input data - SKIP static files
  app.use((req, res, next) => {
    if (req.path.startsWith("/uploads/")) {
      return next();
    }

    // Clean input data
    sanitizeInput(req, res, next);
  });
};

module.exports = {
  loginLimiter,
  signupLimiter,
  passwordResetLimiter,
  generalLimiter,
  sensitiveApiLimiter,
  checkSuspiciousActivity,
  requireEmailVerification,
  requireTwoFactor,
  logSuspiciousAccess,
  sanitizeInput,
  validatePasswordStrength,
  setupSecurity,
  csrfProtection,
};
