# 🏢 Business Networking & Vendor Directory Platform

**Built by Least Action Company** | *Sense • Solve • Scale*

An enterprise-grade, production-ready backend for a Business Networking & Vendor Directory Platform built with Node.js, Express, MongoDB, Socket.IO, Razorpay, Stripe, and Cloudinary.

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js       # MongoDB connection
│   │   ├── redis.js          # Redis connection + cache helpers
│   │   ├── cloudinary.js     # Cloudinary + Multer upload helpers
│   │   └── swagger.js        # Swagger/OpenAPI config
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── vendor.controller.js
│   │   ├── category.controller.js
│   │   ├── service.controller.js
│   │   ├── product.controller.js
│   │   ├── lead.controller.js
│   │   ├── membership.controller.js
│   │   ├── payment.controller.js
│   │   ├── review.controller.js
│   │   ├── event.controller.js
│   │   ├── referral.controller.js
│   │   ├── notification.controller.js
│   │   ├── support.controller.js
│   │   ├── report.controller.js
│   │   ├── directory.controller.js
│   │   └── admin.controller.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Vendor.js
│   │   ├── Category.js
│   │   ├── Service.js
│   │   ├── Product.js
│   │   ├── Lead.js
│   │   ├── Membership.js
│   │   ├── Payment.js
│   │   ├── Review.js
│   │   ├── Event.js
│   │   ├── Referral.js
│   │   ├── Notification.js
│   │   ├── SupportTicket.js
│   │   └── AuditLog.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── vendor.routes.js
│   │   ├── category.routes.js
│   │   ├── service.routes.js
│   │   ├── product.routes.js
│   │   ├── lead.routes.js
│   │   ├── membership.routes.js
│   │   ├── payment.routes.js
│   │   ├── review.routes.js
│   │   ├── event.routes.js
│   │   ├── referral.routes.js
│   │   ├── notification.routes.js
│   │   ├── support.routes.js
│   │   ├── report.routes.js
│   │   ├── directory.routes.js
│   │   └── admin.routes.js
│   ├── middleware/
│   │   ├── auth.js           # JWT protect + authorize + optionalAuth
│   │   ├── errorHandler.js   # AppError, asyncHandler, global error handler
│   │   ├── validate.js       # express-validator error formatter
│   │   └── auditLog.js       # Request audit logging middleware
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── vendor.service.js
│   │   ├── lead.service.js
│   │   ├── payment.service.js
│   │   └── report.service.js
│   ├── sockets/
│   │   └── index.js          # Socket.IO setup + room management
│   ├── jobs/
│   │   └── index.js          # node-cron background jobs
│   ├── constants/
│   │   └── index.js          # App-wide constants & enums
│   ├── utils/
│   │   ├── logger.js         # Winston logger
│   │   ├── response.js       # Standard API response helpers
│   │   ├── jwt.js            # JWT sign/verify/cookies
│   │   └── email.js          # Nodemailer + email templates
│   └── seeds/
│       └── index.js          # Database seed script
├── logs/
│   ├── error.log
│   └── combined.log
├── server.js                 # Entry point
├── package.json
├── .env.example
├── postman_collection.json
└── README.md
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Seed Database
```bash
npm run seed
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Start Production Server
```bash
npm start
```

---

## 🔐 Default Credentials (after seeding)

| Role       | Email                              | Password       |
|------------|------------------------------------|----------------|
| Super Admin | superadmin@vendordirectory.com   | SuperAdmin@123 |
| Admin      | admin@vendordirectory.com          | Admin@123      |
| Vendor     | vendor@vendordirectory.com         | Vendor@123     |
| User       | user@vendordirectory.com           | User@123       |

---

## 📚 API Documentation

Swagger UI: `http://localhost:5000/api/docs`

Health Check: `http://localhost:5000/health`

---

## 🛡️ Roles & Permissions

| Feature                  | Super Admin | Admin | Vendor | User |
|--------------------------|:-----------:|:-----:|:------:|:----:|
| User Management          | ✅          | ✅    | ❌     | ❌   |
| Vendor Approval          | ✅          | ✅    | ❌     | ❌   |
| Create Vendor Profile    | ✅          | ✅    | ✅     | ❌   |
| Manage Own Products      | ✅          | ✅    | ✅     | ❌   |
| Submit Enquiry           | ✅          | ✅    | ✅     | ✅   |
| View Directory           | ✅          | ✅    | ✅     | ✅   |
| Create Review            | ✅          | ✅    | ❌     | ✅   |
| Reply Review             | ✅          | ✅    | ✅     | ❌   |
| Moderate Reviews         | ✅          | ✅    | ❌     | ❌   |
| View Reports             | ✅          | ✅    | ❌     | ❌   |
| Create Admin             | ✅          | ❌    | ❌     | ❌   |
| System Stats             | ✅          | ❌    | ❌     | ❌   |

---

## 💳 Payment Flow

### Razorpay
1. `POST /payments/razorpay/order` → Get order ID
2. Open Razorpay checkout on frontend with order ID
3. `POST /payments/razorpay/verify` → Verify signature
4. Membership/feature activated automatically

### Stripe
1. `POST /payments/stripe/intent` → Get client secret
2. Confirm payment on frontend with Stripe.js
3. Webhook at `POST /payments/webhook/stripe` handles confirmation

---

## 📡 Socket.IO Events

### Client → Server
| Event              | Payload                    | Description              |
|--------------------|----------------------------|--------------------------|
| `set_vendor_id`    | `vendorId`                 | Join vendor room         |
| `join_room`        | `roomName`                 | Join custom room         |
| `leave_room`       | `roomName`                 | Leave room               |
| `typing`           | `{ ticketId }`             | Support chat typing      |

### Server → Client
| Event              | Description                                  |
|--------------------|----------------------------------------------|
| `new_lead`         | New enquiry received (vendor room)           |
| `notification`     | Real-time in-app notification                |
| `user_typing`      | Typing indicator in support                  |
| `request_vendor_id`| Server asks vendor to identify their room    |

---

## ⚙️ Background Jobs (Cron)

| Job                          | Schedule         | Description                        |
|------------------------------|------------------|------------------------------------|
| Membership expiry warnings   | Daily at 8:00 AM | Notify 7d, 3d, 1d before expiry   |
| Deactivate expired plans     | Daily at midnight| Move expired memberships to free   |
| Remove expired featured flag | Every hour       | Cleanup featuredUntil past date    |
| Cleanup old notifications    | Weekly (Sunday)  | Delete 30d+ read notifications     |
| Daily stats compilation      | Daily at 1:00 AM | Log platform metrics               |

---

## 🔧 Environment Variables

See `.env.example` for complete list. Required keys:
- `MONGODB_URI` – MongoDB connection string
- `JWT_SECRET` – Min 32 characters
- `JWT_REFRESH_SECRET` – Refresh token secret
- `SMTP_*` – Email credentials
- `CLOUDINARY_*` – Cloudinary account
- `RAZORPAY_*` – Razorpay keys
- `STRIPE_*` – Stripe keys
- `REDIS_*` – Redis connection (optional, gracefully degrades)

---

## 🏗️ Tech Stack

| Layer          | Technology                           |
|----------------|--------------------------------------|
| Runtime        | Node.js 18+                          |
| Framework      | Express.js 4.x                       |
| Database       | MongoDB + Mongoose 8.x               |
| Cache          | Redis (ioredis) - optional           |
| Auth           | JWT (access + refresh tokens)        |
| File Uploads   | Multer + Cloudinary                  |
| Payments       | Razorpay + Stripe                    |
| Real-time      | Socket.IO 4.x                        |
| Email          | Nodemailer (SMTP)                    |
| Jobs           | node-cron                            |
| Logging        | Winston                              |
| Validation     | express-validator                    |
| Security       | Helmet, Rate Limit, Mongo Sanitize, XSS Clean |
| Docs           | Swagger UI (swagger-jsdoc)           |

---

## 📞 Support

**Least Action Company** | *Sense • Solve • Scale*

For technical support: support@leastaction.in
