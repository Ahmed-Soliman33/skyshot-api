# SkyShot Backend API

A comprehensive Node.js backend API for the SkyShot photography marketplace platform, built with Express.js and MongoDB following clean architecture principles.

## 🚀 Features

- **Complete Photography Platform**: Order management, mission assignments, gallery/store, content management
- **Role-Based Access Control**: User, Partner, Admin, and Master roles with hierarchical permissions
- **Upload Management**: Complete workflow for image/video uploads with approval system
- **Order & Payment System**: Purchase flow with payment simulation and revenue tracking
- **Mission Management**: Partner assignment system for photography requests
- **Content Management**: Pages, Blog, Services, Testimonials, and FAQs
- **Revenue Tracking**: Commission calculations and payout management
- **Notification System**: Real-time notifications for all user interactions
- **Advanced Security**: JWT authentication, rate limiting, data sanitization
- **Comprehensive Validation**: Input validation with express-validator
- **Error Handling**: Centralized error handling with i18n support
- **Multilingual Support**: Arabic and English localization
- **Search & Filtering**: Advanced search and filtering capabilities

## 📁 Project Structure

```
backend/
├── controllers/           # Business logic controllers
│   ├── authController.js
│   ├── userController.js
│   ├── orderController.js
│   ├── missionController.js
│   ├── galleryController.js
│   ├── settingsController.js
│   ├── uploadController.js
│   └── notificationController.js
├── models/               # Mongoose schemas
│   ├── User.js
│   ├── Order.js
│   ├── Mission.js
│   ├── Upload.js
│   ├── Revenue.js
│   ├── Page.js
│   ├── Blog.js
│   ├── Service.js
│   ├── Testimonial.js
│   ├── FAQ.js
│   ├── Notification.js
│   └── Settings.js
├── routes/               # Express routes
│   ├── authRoute.js
│   ├── userRoute.js
│   ├── orderRoutes.js
│   ├── missionRoutes.js
│   ├── galleryRoutes.js
│   ├── settingsRoutes.js
│   ├── uploadRoutes.js
│   ├── notificationRoutes.js
│   └── index.js
├── middlewares/          # Custom middleware
│   ├── errorMiddleware.js
│   ├── securityMiddleware.js
│   ├── validatorMiddleware.js
│   └── deepSanitizeMiddleware.js
├── utils/                # Utility functions
│   ├── validators/       # Input validation schemas
│   ├── ApiError.js
│   ├── ApiFeatures.js
│   ├── generateToken.js
│   ├── sendEmail.js
│   └── userSecurity.js
├── locales/              # Internationalization
│   ├── en.json
│   └── ar.json
├── seeders/              # Database seeders
│   └── index.js
├── config/               # Configuration files
│   ├── database.js
│   ├── passport.js
│   └── security.js
├── app.js                # Express app setup
├── server.js             # Server entry point
└── package.json          # Dependencies and scripts
```

## 🎯 User Roles & Permissions

### User

- Browse gallery/store
- Purchase images/videos
- Upload media for approval
- View order history
- Receive notifications

### Partner

- All User permissions
- Apply for photography missions
- Accept/decline mission assignments
- Complete missions and upload deliverables
- Track earnings and revenue

### Admin

- All User permissions
- Approve/reject media uploads
- Manage content (pages, blog, testimonials, FAQs)
- View orders and customers
- Manage partners (limited)
- Cannot access global settings

### Master

- Full system access
- All Admin permissions
- Manage all users and roles
- Access global settings
- Revenue and commission management
- System configuration

## 🔗 API Endpoints

### Authentication

```
POST   /api/auth/login              # User login
POST   /api/auth/signup             # User registration
POST   /api/auth/refresh-token      # Refresh access token
POST   /api/auth/logout             # User logout
GET    /api/auth/me                 # Get current user
POST   /api/auth/forgot-password    # Request password reset
POST   /api/auth/reset-password     # Reset password
POST   /api/auth/verify-email       # Verify email address
```

### Gallery/Store (Public)

```
GET    /api/gallery                 # Browse approved uploads
GET    /api/gallery/featured        # Get featured uploads
GET    /api/gallery/popular         # Get popular uploads
GET    /api/gallery/search          # Search uploads
GET    /api/gallery/category/:cat   # Get uploads by category
GET    /api/gallery/user/:userId    # Get uploads by user
GET    /api/gallery/:id             # Get upload details
POST   /api/gallery/:id/like        # Like/unlike upload (auth required)
GET    /api/gallery/stats           # Gallery statistics
```

### Orders

```
POST   /api/orders                  # Create new order
GET    /api/orders                  # Get user orders
GET    /api/orders/:id              # Get single order
POST   /api/orders/:id/payment      # Process payment
GET    /api/orders/:id/download/:itemId  # Download purchased item
GET    /api/orders/admin/all        # Get all orders (Admin/Master)
PATCH  /api/orders/:id/status       # Update order status (Admin/Master)
```

### Missions

```
GET    /api/missions/open           # Get open missions (Partner)
POST   /api/missions/:id/apply      # Apply for mission (Partner)
GET    /api/missions/my-missions    # Get partner missions (Partner)
POST   /api/missions/:id/start      # Start mission (Partner)
POST   /api/missions/:id/complete   # Complete mission (Partner)
GET    /api/missions/:id            # Get mission details
POST   /api/missions                # Create mission (Admin/Master)
GET    /api/missions/admin/all      # Get all missions (Admin/Master)
POST   /api/missions/:id/accept/:partnerId  # Accept application (Admin/Master)
```

### Uploads

```
POST   /api/uploads                 # Upload new media
GET    /api/uploads                 # Get user uploads
GET    /api/uploads/:id             # Get upload details
PUT    /api/uploads/:id             # Update upload
DELETE /api/uploads/:id             # Delete upload
POST   /api/uploads/:id/approve     # Approve upload (Admin/Master)
POST   /api/uploads/:id/reject      # Reject upload (Admin/Master)
GET    /api/uploads/admin/pending   # Get pending uploads (Admin/Master)
GET    /api/uploads/admin/all       # Get all uploads (Admin/Master)
```

### Users

```
GET    /api/users                   # Get all users (Admin/Master)
GET    /api/users/:id               # Get user by ID (Admin/Master)
GET    /api/users/getUserByEmail    # Get user by email (Admin/Master)
PATCH  /api/users/:id/promote       # Promote/demote user (Master)
POST   /api/users/:id/activate      # Activate user account (Admin/Master)
DELETE /api/users/:id/deactivate    # Deactivate user account (Admin/Master)
DELETE /api/users/:id               # Delete user (Master)
```

### Settings

```
GET    /api/settings/public         # Get public settings
GET    /api/settings                # Get all settings (Master)
GET    /api/settings/category/:cat  # Get settings by category (Admin/Master)
GET    /api/settings/:key           # Get single setting (Admin/Master)
POST   /api/settings                # Create setting (Master)
PUT    /api/settings/:key           # Update setting (Admin/Master)
PUT    /api/settings/bulk           # Update multiple settings (Master)
DELETE /api/settings/:key           # Delete setting (Master)
POST   /api/settings/initialize     # Initialize default settings (Master)
GET    /api/settings/export         # Export settings (Master)
POST   /api/settings/import         # Import settings (Master)
POST   /api/settings/reset          # Reset to defaults (Master)
```

### Notifications

```
GET    /api/notifications           # Get user notifications
GET    /api/notifications/:id       # Get single notification
PATCH  /api/notifications/:id/read  # Mark notification as read
PATCH  /api/notifications/mark-all-read  # Mark all as read
DELETE /api/notifications/:id       # Delete notification
POST   /api/notifications/admin/send     # Send notification (Admin/Master)
GET    /api/notifications/admin/all      # Get all notifications (Admin/Master)
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd backend
```

2. **Install dependencies**

```bash
npm install
```

3. **Environment Setup**
   Create a `.env` file in the root directory:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/skyshot
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your-refresh-token-secret
REFRESH_TOKEN_EXPIRES=30d
EMAIL_FROM=noreply@skyshot.com
SENDGRID_API_KEY=your-sendgrid-api-key
FRONTEND_URL=http://localhost:3000
```

4. **Database Setup**

```bash
# Start MongoDB service
# Then seed the database with sample data
npm run seed
```

5. **Start the server**

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The API will be available at `http://localhost:5000`

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run seed` - Seed database with sample data
- `npm run seed:dev` - Seed database in development mode
- `npm test` - Run tests

## 📊 Database Models

### Core Models

- **User** - User accounts with role-based permissions
- **Upload** - Media files with approval workflow
- **Order** - Purchase orders and payment tracking
- **Mission** - Photography assignment requests
- **Revenue** - Earnings and commission tracking

### Content Models

- **Page** - Static pages (About, Contact, etc.)
- **Blog** - Blog posts and articles
- **Service** - Service offerings and packages
- **Testimonial** - Customer testimonials
- **FAQ** - Frequently asked questions

### System Models

- **Notification** - User notifications
- **Settings** - System configuration

## 🔒 Security Features

- JWT-based authentication
- Role-based access control
- Rate limiting on sensitive endpoints
- Input validation and sanitization
- Password hashing with bcrypt
- CORS protection
- Helmet security headers
- MongoDB injection prevention

## 🌍 Internationalization

The API supports Arabic and English languages:

- Translation files in `/locales/`
- Localized error messages
- RTL/LTR content support
- Language-specific content models

## 📝 API Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success message",
  "data": {
    // Response data
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

Error responses:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error message",
  "errorCode": "validation_failed",
  "errors": [
    // Validation errors array
  ]
}
```

## 🧪 Testing

The API includes comprehensive test coverage:

```bash
npm test
```

## 📚 Documentation

- API documentation available at `/api/docs` (when running)
- Postman collection included in `/docs/`
- Database schema documentation in `/docs/schema.md`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
└── package.json

````

## 🛠️ Installation & Setup

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Installation Steps

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd backend
````

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment setup**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` file with your configuration:

   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/skyshot
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRES_IN=7d
   FRONTEND_URL=http://localhost:3000
   ```

4. **Start MongoDB**

   ```bash
   # Using MongoDB service
   sudo systemctl start mongod

   # Or using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

5. **Run the application**

   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

6. **Verify installation**
   ```bash
   curl http://localhost:5000/health
   ```

## 📊 User Roles & Permissions

### Role Hierarchy

1. **Master** (Super Admin)
   - Full system control
   - Manage all users and admins
   - System settings configuration
   - Approve/reject all uploads
   - Create system-wide notifications

2. **Admin**
   - Manage regular users
   - Review and approve uploads
   - View analytics and reports
   - Manage content moderation

3. **User**
   - Upload images/videos
   - Manage personal profile
   - View upload statistics
   - Receive notifications

### Upload Workflow

```
User uploads → Status: PENDING → Admin/Master reviews → APPROVED/REJECTED
                                                      ↓
                                               Marketplace (Public)
```

## 🔌 API Endpoints

### Authentication & Users

```
POST   /api/auth/register          # User registration
POST   /api/auth/login             # User login
POST   /api/auth/logout            # User logout
GET    /api/users                  # Get all users (Admin)
GET    /api/users/:id              # Get user by ID
POST   /api/users                  # Create user (Admin)
PUT    /api/users/:id              # Update user
DELETE /api/users/:id              # Delete user (Master)
PATCH  /api/users/:id/role         # Change user role (Master)
PATCH  /api/users/:id/activate     # Activate account (Admin)
PATCH  /api/users/:id/deactivate   # Deactivate account (Admin)
GET    /api/users/search           # Search users (Admin)
POST   /api/users/bulk             # Bulk operations (Master)
```

### Uploads Management

```
GET    /api/uploads                # Get all uploads (Admin)
GET    /api/uploads/filter         # Get filtered uploads (Public)
GET    /api/uploads/:id            # Get upload by ID
POST   /api/uploads               # Create upload (User)
PUT    /api/uploads/:id           # Update upload (Owner/Admin)
DELETE /api/uploads/:id           # Delete upload (Owner/Admin)
PATCH  /api/uploads/:id/approve   # Approve upload (Admin)
PATCH  /api/uploads/:id/reject    # Reject upload (Admin)
GET    /api/uploads/pending       # Get pending uploads (Admin)
GET    /api/uploads/search        # Search uploads (Public)
POST   /api/uploads/bulk          # Bulk operations (Admin)
```

### Notifications

```
GET    /api/notifications         # Get user notifications
GET    /api/notifications/:id     # Get notification by ID
PATCH  /api/notifications/:id/read # Mark as read
PATCH  /api/notifications/read-all # Mark all as read
DELETE /api/notifications/:id     # Delete notification
POST   /api/notifications         # Create notification (Admin)
POST   /api/notifications/system  # System notification (Master)
POST   /api/notifications/bulk    # Bulk operations (Admin)
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevent abuse with configurable rate limits
- **Data Sanitization**: Protection against NoSQL injection and XSS
- **CORS Configuration**: Secure cross-origin resource sharing
- **Helmet Security**: Security headers for production
- **Input Validation**: Comprehensive validation with express-validator
- **Password Hashing**: Bcrypt for secure password storage

## 📝 Request/Response Format

### Success Response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "success.data_retrieved",
  "messageCode": "success.data_retrieved",
  "data": { ... },
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "statusCode": 400,
  "message": "user.email_already_exists",
  "messageCode": "user.email_already_exists",
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

### Pagination Response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "success.data_retrieved",
  "data": {
    "results": 10,
    "totalResults": 150,
    "totalPages": 15,
    "currentPage": 1,
    "data": [ ... ]
  }
}
```

## 🔍 Query Parameters

### Filtering

```
GET /api/uploads?status=approved&category=photography&featured=true
```

### Sorting

```
GET /api/uploads?sort=-createdAt,title
```

### Pagination

```
GET /api/uploads?page=2&limit=20
```

### Search

```
GET /api/uploads/search?q=landscape&category=photography
```

### Field Selection

```
GET /api/users?fields=firstName,lastName,email
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- userController.test.js
```

## 📦 Deployment

### Environment Variables for Production

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/skyshot
JWT_SECRET=your-production-jwt-secret
FRONTEND_URL=https://your-frontend-domain.com
```

### Docker Deployment

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### PM2 Process Manager

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# Logs
pm2 logs
```

## 🔧 Configuration

### Database Indexes

The application automatically creates necessary indexes for optimal performance:

- User email (unique)
- Upload status and creation date
- Notification user and read status
- Text search indexes for uploads

### File Upload Configuration

```javascript
// Maximum file size: 50MB
MAX_FILE_SIZE = 50000000;

// Allowed file types
ALLOWED_TYPES = ["jpg", "jpeg", "png", "gif", "mp4", "mov", "avi"];
```

## 📈 Monitoring & Logging

- **Morgan**: HTTP request logging
- **Error Tracking**: Centralized error handling
- **Health Check**: `/health` endpoint for monitoring
- **Performance**: Built-in compression and optimization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Run the test suite
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

- Check the API documentation
- Review error messages and codes
- Check server logs for detailed error information
- Ensure all environment variables are properly configured

## 🔄 API Versioning

Current API version: v1
Base URL: `/api/`

Future versions will be available at `/api/v2/`, etc.
