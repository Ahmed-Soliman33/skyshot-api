const {
  sensitiveApiLimiter,
  requireEmailVerification,
  requireTwoFactor,
} = require("../middlewares/securityMiddleware");
const authRoute = require("./authRoute");
const userRoute = require("./userRoute");
const orderRoutes = require("./orderRoutes");
const missionRoutes = require("./missionRoutes");
const galleryRoutes = require("./galleryRoutes");
const settingsRoutes = require("./settingsRoutes");
const uploadRoutes = require("./uploadRoutes");
const notificationRoutes = require("./notificationRoutes");
const path = require("path");
const express = require("express");

exports.mountRoutes = (app) => {
  // Static files
  app.use("/api/uploads", express.static(path.join(__dirname, "../uploads")));

  // Authentication routes
  app.use("/api/auth", authRoute);

  // User management routes
  app.use("/api/users", userRoute);

  // Public gallery/store routes
  app.use("/api/gallery", galleryRoutes);

  // Public settings routes
  app.use("/api/settings", settingsRoutes);

  // Protected routes
  app.use("/api/orders", orderRoutes);
  app.use("/api/missions", missionRoutes);
  app.use("/api/uploads", uploadRoutes);
  app.use("/api/notifications", notificationRoutes);

  // Admin routes with enhanced security
  app.use(
    "/api/admin",
    sensitiveApiLimiter,
    requireEmailVerification,
    requireTwoFactor
  );
};
