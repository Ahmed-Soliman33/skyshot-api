/**
 * Security Configuration
 * Application security settings
 */

const securityConfig = {
  // Password settings
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: "@$!%*?&",
    bcryptRounds: 14, // Number of encryption rounds

    // Password strength validation pattern
    strongPasswordRegex:
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,

    // Error messages
    errors: {
      tooShort: "Password must be at least 8 characters long",
      tooLong: "Password cannot exceed 128 characters",
      missingUppercase: "Password must contain at least one uppercase letter",
      missingLowercase: "Password must contain at least one lowercase letter",
      missingNumber: "Password must contain at least one number",
      missingSpecialChar:
        "Password must contain at least one special character (@$!%*?&)",
      weak: "Password does not meet security requirements",
    },
  },

  // Account locking settings
  accountLocking: {
    maxLoginAttempts: 5,
    lockDuration: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
    resetAttemptsOnSuccess: true,
  },

  // إعدادات reset Password
  passwordReset: {
    codeLength: 32, // طول الكود بالبايت
    expirationTime: 10 * 60 * 1000, // 10 minutes بالميلي ثانية
    hashAlgorithm: "sha256",
    maxAttemptsPerHour: 3,
  },

  // إعدادات Verify Email address
  emailVerification: {
    tokenLength: 32, // طول الرمز بالبايت
    hashAlgorithm: "sha256",
    required: false, // هل Verify البريد إجباري؟
    resendCooldown: 5 * 60 * 1000, // 5 minutes بين إعادة الإرسال
  },

  // إعدادات كشف النشاط الsuspicious
  suspiciousActivity: {
    // عدد عناوين IP المختلفة في فترة زمنية
    maxIPsInTimeWindow: 3,
    ipTimeWindow: 30 * 60 * 1000, // 30 minutes

    // عدد محاولات تسجيل الدخول السريعة
    maxRapidAttempts: 3,
    rapidAttemptsWindow: 5 * 60 * 1000, // 5 minutes

    // تنظيف سجل تسجيل الدخول
    loginHistoryRetention: 30 * 24 * 60 * 60 * 1000, // 30 يوم
    maxLoginHistoryEntries: 10,
  },

  // إعدادات Rate Limiting
  rateLimiting: {
    // تسجيل الدخول
    login: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 محاولات
      message: "Too many login attempts, please try again later",
    },

    // reset Password
    passwordReset: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // 3 محاولات
      message: "Too many password reset attempts, please try again later",
    },

    // general
    general: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 طلب
      message: "Too many requests, please try again later",
    },

    // API حساسة
    sensitive: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // 10 طلبات
      message:
        "Too many requests to sensitive endpoint, please try again later",
    },
  },

  // إعدادات Verify صحة البيانات
  validation: {
    // الأسماء
    name: {
      minLength: 1,
      maxLength: 50,
      allowedChars: /^[a-zA-Z\u0600-\u06FF\s]+$/, // عربي وإنجليزي ومسافات
      errors: {
        tooShort: "Name must be at least 1 character long",
        tooLong: "Name cannot exceed 50 characters",
        invalidChars: "Name can only contain letters and spaces",
      },
    },

    // Email address
    email: {
      maxLength: 100,
      errors: {
        invalid: "Please provide a valid email address",
        tooLong: "Email cannot exceed 100 characters",
      },
    },

    // رقم الهاتف
    phone: {
      maxLength: 20,
      errors: {
        invalid: "Please provide a valid phone number",
        tooLong: "Phone number cannot exceed 20 characters",
      },
    },

    // العمر
    age: {
      min: 13,
      max: 120,
      errors: {
        tooYoung: "Age must be at least 13 years",
        tooOld: "Age cannot exceed 120 years",
      },
    },
  },

  // إعدادات الجلسة والرموز
  session: {
    // JWT
    jwt: {
      expiresIn: "24h",
      refreshExpiresIn: "7d",
      algorithm: "HS256",
    },

    // Refresh Token
    refreshToken: {
      length: 32,
      expiresIn: 7 * 24 * 60 * 60 * 1000, // 7 أيام
    },
  },

  // إعدادات الخصوصية
  privacy: {
    // مستويات الرؤية
    visibilityLevels: ["public", "private", "friends"],
    defaultVisibility: "public",
  },

  // إعدادات الصيانة
  maintenance: {
    // Cleanup accounts inactive
    inactiveAccountCleanup: {
      enabled: true,
      daysInactive: 365, // سنة واحدة
      runInterval: 24 * 60 * 60 * 1000, // يومياً
    },

    // تنظيف الرموز المنتهية الصلاحية
    expiredTokenCleanup: {
      enabled: true,
      runInterval: 60 * 60 * 1000, // كل hour
    },
  },

  // إعدادات التسجيل والمراقبة
  logging: {
    // تسجيل محاولات تسجيل الدخول
    logLoginAttempts: true,

    // تسجيل النشاط الsuspicious
    logSuspiciousActivity: true,

    // تسجيل تغييرات Password
    logPasswordChanges: true,

    // تسجيل الوصول للAPI الحساسة
    logSensitiveApiAccess: true,

    // مستوى التفاصيل
    logLevel: "info", // debug, info, warn, error
  },

  // إعدادات التنبيهات
  alerts: {
    // تنبيه عند النشاط الsuspicious
    suspiciousActivityAlert: {
      enabled: true,
      methods: ["email", "log"], // email, sms, log, webhook
      threshold: 1, // عدد الأنشطة الsuspiciousة قبل التنبيه
    },

    // تنبيه عند محاولات اختراق
    bruteForceAlert: {
      enabled: true,
      methods: ["email", "log"],
      threshold: 3, // عدد المحاولات قبل التنبيه
    },

    // تنبيه عند تغيير Password
    passwordChangeAlert: {
      enabled: true,
      methods: ["email"],
    },
  },

  // إعدادات المصادقة الثنائية
  twoFactor: {
    enabled: false, // تفعيل المصادقة الثنائية
    required: false, // هل هي إجبارية؟
    methods: ["totp", "sms"], // الطرق المدعومة
    backupCodes: {
      count: 10,
      length: 8,
    },
  },
};

module.exports = securityConfig;
