#  SocialSphere - Advanced Social Media Platform

A full-stack social media platform built with Node.js, React, Socket.io, and MongoDB — featuring real-time messaging, Cloudinary media uploads, comprehensive testing, and CI/CD deployment.

![Architecture](architecture-diagram.png)

##  Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Socket.io-client, Axios, Framer Motion |
| Backend | Node.js, Express, Socket.io, MongoDB/Mongoose |
| Auth | JWT (Access + Refresh tokens), bcrypt |
| Media | Cloudinary (images + videos) |
| Security | Helmet, Rate Limiting, XSS Protection, CORS, HPP |
| Testing | Jest, Supertest, Vitest, React Testing Library |
| CI/CD | GitHub Actions |
| Docker | Multi-stage builds, Docker Compose |

---

##  Project Structure

```
social-media-platform/
├── backend/
│   ├── src/
│   │   ├── config/          # DB, Cloudinary setup
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/      # Auth, error handling
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # API route definitions
│   │   ├── socket/          # Socket.io manager
│   │   ├── utils/           # Helpers
│   │   ├── app.js           # Express app
│   │   └── server.js        # Entry point
│   └── tests/
│       ├── unit/            # Model/util tests
│       └── integration/     # API endpoint tests
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── contexts/        # Auth, Socket contexts
│   │   ├── hooks/           # Custom React hooks
│   │   ├── pages/           # Route pages
│   │   └── services/        # API service layer
│   └── tests/               # Component & hook tests
├── tests/
│   └── e2e/                 # Playwright E2E tests
├── docker/
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   ├── docker-compose.yml
│   └── nginx.conf
└── .github/
    └── workflows/
        └── ci-cd.yml        # Full CI/CD pipeline
```

---

##  Getting Started

### Prerequisites
- Node.js 18+
- MongoDB 6+
- Cloudinary account

### Local Development

```bash
# 1. Clone repository
git clone <your-repo-url>
cd social-media-platform

# 2. Setup backend
cd backend
cp .env.example .env
# Fill in .env with your credentials
npm install
npm run dev

# 3. Setup frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm start
```

### Docker Development
```bash
cd docker
docker-compose up -d
```

---

##  Testing

### Backend Tests
```bash
cd backend

# Run all tests with coverage
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration
```

### Frontend Tests
```bash
cd frontend

# Run all tests
npm test

# Watch mode
npm run test:ui
```

### E2E Tests
```bash
# Install Playwright
npx playwright install

# Run E2E tests
cd tests/e2e
npx playwright test
```

---

##  Real-Time Features (Socket.io)

### Events (Client → Server)
| Event | Payload | Description |
|-------|---------|-------------|
| `join-chat` | `chatId` | Join a chat room |
| `leave-chat` | `chatId` | Leave a chat room |
| `send-message` | `{chatId, content, messageType}` | Send a message |
| `typing` | `{chatId, isTyping}` | Typing indicator |

### Events (Server → Client)
| Event | Payload | Description |
|-------|---------|-------------|
| `new-message` | `{chatId, message}` | New chat message |
| `notification` | `{notification}` | Push notification |
| `user-typing` | `{userId, isTyping, chatId}` | Typing status |
| `user-online` | `{userId, isOnline}` | Presence update |
| `message-notification` | `{chatId, sender, preview}` | New message alert |

---

##  Security Features

- **JWT Authentication** — Access tokens (7d) + Refresh tokens (30d)
- **Account Lockout** — After 5 failed login attempts (2hr lockout)
- **Rate Limiting** — 100 req/15min globally, 10 auth attempts/15min
- **Security Headers** — Via Helmet (CSP, HSTS, X-Frame-Options, etc.)
- **Input Sanitization** — MongoDB injection prevention, XSS cleaning
- **Password Hashing** — bcrypt with salt rounds of 12
- **HTTP Parameter Pollution** — Prevented via hpp middleware

---

##  API Endpoints

### Auth
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/refresh
POST   /api/auth/forgot-password
PUT    /api/auth/reset-password/:token
```

### Posts
```
GET    /api/posts/feed
GET    /api/posts/search?q=query
POST   /api/posts
GET    /api/posts/:id
PUT    /api/posts/:id/like
POST   /api/posts/:id/comments
DELETE /api/posts/:id
```

### Users
```
GET    /api/users/:username
GET    /api/users/:username/posts
POST   /api/users/:userId/follow
PUT    /api/users/me/profile
GET    /api/users/search/users?q=query
```

### Chat
```
GET    /api/chat
POST   /api/chat/direct
POST   /api/chat/group
GET    /api/chat/:chatId/messages
POST   /api/chat/:chatId/messages
```

### Notifications
```
GET    /api/notifications
PUT    /api/notifications/read
DELETE /api/notifications/:id
```

---

##  CI/CD Pipeline

```
Push to develop → Backend Tests → Frontend Tests → Security Scan → Docker Build → Deploy Staging
Push to main    → All tests   → Security Scan  → Docker Build → Deploy Production
```

---

##  Performance Optimizations

- **Indexes** — All frequently queried fields indexed in MongoDB
- **Pagination** — Cursor-based pagination on all list endpoints
- **Compression** — gzip via Express compression middleware
- **Caching headers** — Static assets with 1-year cache
- **Virtual fields** — Computed values without DB overhead
- **Lean queries** — `.lean()` for read-heavy operations
- **Connection pooling** — Mongoose built-in

---

##  Deployment

See `docker/` directory for production Docker setup. Environment variables required:

- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — Strong random secret (32+ chars)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `FRONTEND_URL` — Your frontend domain

---

##  License

MIT


By
Santhosh Kakarla