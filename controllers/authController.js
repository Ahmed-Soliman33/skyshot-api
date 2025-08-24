const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const generateToken = require("../utils/generateToken");
const ApiError = require("../utils/ApiError");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const passport = require("passport");

// Options for the refresh token cookie
const isProd = process.env.NODE_ENV === "production";

const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "None" : "Lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/api",
  // domain: ".yourdomain.com" // استخدمها بس لو عندك custom domain وعايز تشارك بين ساب-دومينز
};

// Send access and refresh tokens in the response
const sendResponse = async (req, res, user, code) => {
  const token = generateToken(user._id);
  const refreshToken = jwt.sign(
    { userId: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES }
  );

  const updatedData = req
    ? {
        refreshToken,
        lastLoginAt: new Date(Date.now()),
        lastLoginIP: req.ip,
        loginHistory: [
          {
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            timestamp: new Date(Date.now()),
            success: true,
          },
          ...user.loginHistory,
        ],
      }
    : { refreshToken };

  // Update user document with the new refresh token
  const updated = await User.findByIdAndUpdate(user._id, updatedData, {
    new: true,
  });
  if (process.env.NODE_ENV === "development") {
    console.log("User document updated:", updated);
  }

  // Set refresh token cookie and send JWT in the response
  res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);

  user.password = undefined; // Exclude password from response
  user.refreshToken = undefined; // Exclude refresh token from response

  res.status(code).json({ status: "success", token, data: user });
};

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
exports.signup = asyncHandler(async (req, res, next) => {
  const { firstName, lastName, email, password, role } = req.body;

  if (role === "admin" || role === "master") {
    return next(
      new ApiError(
        "You can't create a user with this role",
        403,
        "roleForbidden"
      )
    );
  }

  if (role === "partner") {
    if (!req.body.phone) {
      return next(
        new ApiError(
          "Phone number is required for partners",
          400,
          "phone_required_for_partners"
        )
      );
    }

    if (!req.body.country || !req.body.birthDate) {
      return next(
        new ApiError(
          "Country and birth date are required for partners",
          400,
          "country_birth_required_for_partners"
        )
      );
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone: req.body.phone,
      country: req.body.country,
      birthDate: req.body.birthDate,
      role,
    });
    return sendResponse(req, res, user, 201);
  }

  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
  });

  if (process.env.NODE_ENV === "development") {
    console.log("User created:", req.body);
  }

  sendResponse(req, res, user, 201);
});

// @desc    Authenticate user
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  // Verify user existence and password match
  const user = await User.findOne({ email: req.body.email });

  if (!user || !(await user.comparePassword(req.body.password))) {
    return next(
      new ApiError("Incorrect email or password", 401, "invalidCredentials")
    );
  }

  // Generate and send authentication tokens
  sendResponse(req, res, user, 201);
});

// @desc    Start Google OAuth
// @route   GET /api/auth/google
// @access  Public
exports.googleAuth = (req, res, next) => {
  passport.authenticate("google", {
    scope: ["profile", "email"],
    accessType: "offline",
    prompt: "consent",
  })(req, res, next);
};

// @desc    Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
exports.googleCallback = asyncHandler(async (req, res, next) => {
  passport.authenticate("google", { session: false }, async (err, user) => {
    if (err) {
      return res.redirect(`${process.env.FRONTEND_URL}/auth?error=oauth_error`);
    }

    if (!user) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/auth?error=oauth_failed`
      );
    }

    try {
      const token = generateToken(user._id);
      const refreshToken = jwt.sign(
        { userId: user._id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRES }
      );

      const updatedData = {
        refreshToken,
        lastLoginAt: new Date(Date.now()),
        lastLoginIP: req.ip,
        loginHistory: [
          {
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            timestamp: new Date(Date.now()),
            success: true,
          },
          ...user.loginHistory,
        ],
      };

      // Update user document with the new refresh token
      const updated = await User.findByIdAndUpdate(user._id, updatedData, {
        new: true,
      });
      if (process.env.NODE_ENV === "development") {
        console.log("User document updated:", updated);
      }

      // Set refresh token cookie and send JWT in the response
      res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);

      user.password = undefined; // Exclude password from response
      user.refreshToken = undefined; // Exclude refresh token from response

      res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${token}`);
    } catch (error) {
      console.error("Token generation error:", error);
      res.redirect(`${process.env.FRONTEND_URL}/auth?error=token_error`);
    }
  })(req, res, next);
});

// @desc    Refresh access token
// @route   GET /api/auth/refresh-token
// @access  Private
exports.refreshAccessToken = asyncHandler(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return next(
      new ApiError(
        "You are not logged in, please log in",
        401,
        "not_authenticated"
      )
    );
  }

  const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  const user = await User.findById(decoded.userId);

  if (!user || user.refreshToken !== refreshToken) {
    return next(
      new ApiError("Invalid refresh token", 403, "invalid_refresh_token")
    );
  }

  // Rotate refresh token and issue new tokens
  sendResponse(null, res, user, 200);
});

// @desc    Log out user (Enhanced version)
// @route   POST /api/auth/logout
// @access  Public
exports.logout = asyncHandler(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;
  let logoutSuccess = false;

  if (refreshToken) {
    try {
      // التحقق من صحة الـ token قبل الحذف
      const decoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET
      );

      // حذف الـ refresh token من قاعدة البيانات
      const updatedUser = await User.findOneAndUpdate(
        {
          _id: decoded.userId,
          refreshToken,
        },
        {
          refreshToken: null,
          lastLogoutAt: new Date(),
        },
        { new: true }
      );

      if (updatedUser) {
        logoutSuccess = true;
        console.log(`User ${updatedUser.email} logged out successfully`);
      }
    } catch (error) {
      // Token غير صالح أو منتهي الصلاحية
      console.warn("Invalid refresh token during logout:", error.message);

      // حذف أي token غير صالح من قاعدة البيانات
      await User.updateMany({ refreshToken }, { refreshToken: null });
    }
  }

  // حذف الـ cookie في جميع الحالات
  res.cookie("refreshToken", "", {
    ...refreshTokenCookieOptions,
    maxAge: 0,
  });

  res.status(200).json({
    status: "success",
    message: logoutSuccess
      ? "Logged out successfully"
      : "Logged out (session was already invalid)",
    logoutSuccess,
  });
});

// @desc    Retrieve current user details
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return next(new ApiError("User not found", 404, "user_not_found"));
  }
  res.status(200).json({ status: "success", data: user });
});

// @desc    Protect routes with authentication
exports.protect = asyncHandler(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;
  // Extract and validate access token from headers
  let accessToken;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    accessToken = req.headers.authorization.split(" ")[1];
  }
  if (!accessToken) {
    return next(
      new ApiError(
        "Unauthorized access, please log in",
        401,
        "not_authenticated"
      )
    );
  }

  // Extract and validate refresh token from cookies
  if (!refreshToken) {
    return next(
      new ApiError(
        "Unauthorized access, you are not logged in",
        401,
        "not_authenticated"
      )
    );
  }

  // Verify refresh token integrity and expiration
  const decodedRefresh = jwt.verify(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  // Verify access token integrity and expiration
  const decodedAccess = jwt.verify(
    accessToken,
    process.env.ACCESS_TOKEN_SECRET
  );

  // Validate user existence
  const currentUser = await User.findById(decodedAccess.userId);
  if (!currentUser) {
    return next(
      new ApiError(
        "User associated with token no longer exists",
        401,
        "user_not_found"
      )
    );
  }

  // Check if refresh token user ID matches the access token user ID
  if (decodedRefresh.userId !== decodedAccess.userId) {
    return next(
      new ApiError("Invalid token, please log in again", 401, "invalid_token")
    );
  }

  // Check if password was changed after token issuance
  if (currentUser.passwordChangedAt) {
    const passChangedTimestamp = parseInt(
      currentUser.passwordChangedAt.getTime() / 1000,
      10
    );
    if (passChangedTimestamp > decodedAccess.iat) {
      return next(
        new ApiError(
          "Password recently changed, please log in again",
          401,
          "password_changed"
        )
      );
    }
  }
  if (process.env.NODE_ENV === "development") {
    console.log("Current user:", currentUser);
  }

  // Attach user to request object
  req.user = currentUser;
  next();
});


// @desc    Authorize user roles
// @route   Middleware
// @access  Private
/**
 * @param {...("user" |"admin" | "partner" | "manager")} roles
 * @returns {void}
 */
exports.allowedTo = (...roles) =>
  asyncHandler(async (req, res, next) => {
    // Validate user role against permitted roles
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          "You do not have permission to perform this action",
          403,
          "not_authorized"
        )
      );
    }
    next();
  });



// @desc    Update my account data
// @route   PUT /api/auth/editMe
// @access  Private
exports.editMe = asyncHandler(async (req, res, next) => {
  if (req.body.password) {
    return next(
      new ApiError(
        "This route is not for password updates. Please use reset password route.",
        400,
        "invalid_route"
      )
    );
  }

  if (req.body.email) {
    return next(
      new ApiError(
        "This route is not for email updates. Please use verify email route.",
        400,
        "invalid_route"
      )
    );
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone,
      country: req.body.country,
      birthDate: req.body.birthDate,
      bio: req.body.bio,
      profileVisibility: req.body.profileVisibility,
      avatar: req.body.avatar,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!updatedUser) {
    return next(new ApiError("User not found", 404, "user_not_found"));
  }

  res.status(200).json({ data: updatedUser, status: "success" });
});

// @desc    Upload avatar
// @route   POST /api/auth/upload-avatar
// @access  Private
exports.uploadAvatar = asyncHandler(async (req, res, next) => {
  console.log({ file: req.file, req });

  if (!req.file) {
    return next(new ApiError("No file uploaded", 400, "no_file_uploaded"));
  }

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return next(
      new ApiError(
        "Invalid file type. Only JPEG, PNG, and WebP are allowed",
        400,
        "invalid_file_type"
      )
    );
  }

  // Validate file size (5MB)
  if (req.file.size > 5 * 1024 * 1024) {
    return next(
      new ApiError(
        "File size too large. Maximum 5MB allowed",
        400,
        "file_too_large"
      )
    );
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    {
      avatar: `/uploads/avatars/${req.file.filename}`,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!updatedUser) {
    return next(new ApiError("User not found", 404, "user_not_found"));
  }

  // Remove sensitive data from response
  updatedUser.password = undefined;
  updatedUser.refreshToken = undefined;

  res.status(200).json({
    data: updatedUser,
    status: "success",
    message: "Avatar uploaded successfully",
  });
});
// @desc    Verify account activation status
// @route   Middleware
// @access  Private
exports.checkAccountActive = asyncHandler(async (req, res, next) => {
  if (!req.user.active) {
    return next(
      new ApiError(
        "Account deactivated, please activate it",
        401,
        "account_deactivated"
      )
    );
  }
  next();
});

// @desc    Deactivate Logged User
// @route   DELETE /api/auth/deactivateMyAccount
// @access  Private/Protected
exports.deactivateMyAccount = asyncHandler(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user._id, {
    active: false,
  });
  res
    .status(204)
    .json({ status: "success", message: "Account deactivated successfully" });
});


// @desc    Send email verification token
// @route   POST /api/auth/send-verification
// @access  Private
exports.sendEmailVerification = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new ApiError("User not found", 404, "user_not_found"));
  }

  if (user.emailVerified) {
    return next(
      new ApiError("Email is already verified", 400, "email_verified")
    );
  }

  // إنشاء رمز التحقق
  const verificationToken = user.createEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  // إرسال البريد الإلكتروني
  try {
    await sendEmail({
      email: user.email,
      subject: "Email Verification - Skyshot",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Email Verification</h2>
          <p>Dear ${user.firstName} ${user.lastName},</p>
          <p>Please click the link below to verify your email address:</p>
          <a href="${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&userId=${user._id}" 
             style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Verify Email
          </a>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <p>Best regards,<br/>Skyshot Team</p>
        </div>
      `,
    });

    res.status(200).json({
      status: "success",
      message: "Verification email sent successfully",
    });
  } catch (error) {
    user.emailVerificationToken = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new ApiError("Failed to send verification email", 500));
  }
});

// @desc    Verify email address
// @route   POST /api/auth/verify-email
// @access  Public
exports.verifyEmail = asyncHandler(async (req, res, next) => {
  const { token, userId } = req.body;

  if (!token || !userId) {
    return next(new ApiError("Token and user ID are required", 400));
  }

  // البحث عن المستخدم
  const user = await User.findById(userId).select("+emailVerificationToken");

  if (!user) {
    return next(new ApiError("Invalid verification link", 400));
  }

  if (user.emailVerified) {
    return next(new ApiError("Email is already verified", 400));
  }

  // التحقق من صحة الرمز
  if (!user.verifyEmailToken(token)) {
    return next(new ApiError("Invalid or expired verification token", 400));
  }

  // تأكيد البريد الإلكتروني
  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    message: "Email verified successfully",
  });
});

//  ------------------------- PASSWORD RESET CYCLE -------------------------

// @desc    Initiate password reset process
// @route   POST /api/auth/forgotPassword
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  // Retrieve user based on provided email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(
      new ApiError(
        `No user found with email: ${req.body.email}`,
        404,
        "email_not_found"
      )
    );
  }

  // Generate a 6-digit reset code
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash and store the reset code
  const hashedResetCode = crypto
    .createHash("sha256")
    .update(resetCode)
    .digest("hex");
  user.passwordResetCode = hashedResetCode;
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  user.passwordResetVerified = false;
  await user.save();

  // Send reset code via email
  try {
    await sendEmail({
      email: user.email,
      subject: "Password Reset Code (Valid for 10 minutes)",
      html: `
        <h4>Dear ${user.name}</h4>
        <p>We have received a request to reset your password for your Skyshot account.</p>
        <b>${resetCode}</b>
        <br />
        <p>Please use this code to complete the password reset process.</p>
        <span>This code will expire in 10 minutes.</span>
        <p>Best regards,<br />Skyshot Team</p>
      `,
    });
  } catch (error) {
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    user.passwordResetVerified = undefined;
    await user.save();
    return next(
      new ApiError("Failed to send reset email", 500, "email_send_error")
    );
  }
  res
    .status(200)
    .json({ status: "success", message: "Reset code sent to your email" });
});

// @desc    Verify password reset code
// @route   POST /api/auth/verifyResetCode
// @access  Public
exports.verifyPassResetCode = asyncHandler(async (req, res, next) => {
  // Validate reset code against stored hash
  const hashedResetCode = crypto
    .createHash("sha256")
    .update(req.body.resetCode)
    .digest("hex");
  const user = await User.findOne({
    passwordResetCode: hashedResetCode,
    passwordResetExpires: { $gt: Date.now() },
  });
  if (!user) {
    return next(
      new ApiError("Invalid or expired reset code", 404, "invalid_reset_code")
    );
  }

  // Mark reset code as verified
  user.passwordResetVerified = true;
  await user.save();

  res.status(200).json({ status: "success" });
});

// @desc    Reset user password
// @route   PUT /api/auth/resetPassword
// @access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  // Retrieve user based on email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(
      new ApiError(
        "No user found with this email address",
        404,
        "email_not_found"
      )
    );
  }

  // Validate reset code verification
  if (!user.passwordResetVerified) {
    return next(
      new ApiError("Reset code not verified", 404, "reset_code_not_verified")
    );
  }

  // Update user password and clear reset fields
  user.password = req.body.newPassword;
  user.passwordResetCode = undefined;
  user.passwordResetExpires = undefined;
  user.passwordResetVerified = undefined;
  await user.save();

  // Generate and send new authentication tokens
  sendResponse(null, res, user, 200);
});
