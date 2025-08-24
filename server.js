const express = require("express");
const dotenv = require("dotenv");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const cookieSession = require("cookie-session");
const path = require("path");

const dbConnection = require("./config/database");
const deepSanitize = require("./middlewares/deepSanitizeMiddleware");
const globalErrorHandler = require("./middlewares/errorMiddleware");
const { setupSecurity } = require("./middlewares/securityMiddleware");

const ApiError = require("./utils/ApiError");
const { mountRoutes } = require("./routes");

// Connect to the database
dbConnection();

// Load environment variables from config.env file
dotenv.config({ path: "config.env" });

// Passport configuration
require("./config/passport");

const PORT = process.env.PORT || 3000;

const app = express();

/* Middlewares */

// CORS configuration
const allowedOrigins = [
  "https://skyshot-one.vercel.app", // الفرونت أونلاين
  "http://localhost:3000", // للتجربة
  "http://localhost:5173",
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (!origin || allowedOrigins.includes(origin)) {
    if (origin) res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
  }
  next();
});

// Serve static files for avatars
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(
  cookieSession({
    name: "session",
    keys: ["skyshot"],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Body parser middleware FIRST
app.use(express.json({ limit: "10kb" }));

app.use(express.urlencoded({ extended: true }));

// Parses cookies from incoming requests.
app.use(cookieParser());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
  console.log(`mode: ${process.env.NODE_ENV}`);
}

// Custom sanitization instead of express-mongo-sanitize
app.use((req, res, next) => {
  req.body = deepSanitize(req.body);
  req.query = deepSanitize(req.query);
  req.params = deepSanitize(req.params);
  next();
});

// Apply security middleware (without mongo-sanitize)
setupSecurity(app);

// Mount Routes
mountRoutes(app);

// Catch-all route for undefined routes
app.use((req, res, next) => {
  const error = new ApiError(
    `Can't find ${req.originalUrl} on this server!`,
    400
  );
  next(error);
});

// Global Error handling middleware
app.use(globalErrorHandler);

const server = app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});

// Handle unhandled promise (asynchronous) rejections outside express
process.on("unhandledRejection", (err) => {
  console.error(`Unhandled Rejection Error: ${err.name} | ${err.message}`);
  // Close the server and exit the process
  server.close(() => {
    console.error("Shutting down...");
    process.exit(1);
  });
});

module.exports = app;
