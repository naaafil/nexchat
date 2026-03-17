# NexChat Workspace

## Overview

NexChat - Real-time chat application built with Node.js, Express, Socket.IO, MongoDB Atlas, and JWT auth. Full-stack monorepo with a single-page frontend served by the Express server.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: MongoDB Atlas (Mongoose)
- **Real-time**: Socket.IO
- **Auth**: JWT + OTP-based login (phone/email)
- **File uploads**: Multer (local disk, /uploads)
- **Build**: esbuild (CJS bundle)

## NexChat Features

1. Login via phone number or email with OTP verification
2. Auto-generated unique ID format: NCX-XXXXXX
3. 1-on-1 direct chat and group chat with admin controls
4. Real-time online/offline status
5. File and image uploads (up to 20MB)
6. Search friends by NexID
7. Voice messages (MediaRecorder API, audio/webm)
8. WebRTC peer-to-peer audio and video calls
9. Message deletion (sender only, soft-delete with isDeleted flag)
10. Profile settings with avatar photo upload
11. Story/Status 24 jam (text + photo, auto-expire via MongoDB TTL index)
12. Reply/Quote pesan (replyTo embedded in Message model)
13. Forward pesan ke chat lain
14. Pin pesan penting (displayed in banner at top of chat)
15. Push Notifications via Web Push API (VAPID keys, service worker)
16. Tema gelap dan terang (persisted in localStorage)

## Structure

```text
artifacts/api-server/
├── src/
│   ├── index.ts          # Entry — reads PORT, connects DB, starts server
│   ├── app.ts            # Express + Socket.IO setup
│   ├── models/
│   │   ├── User.ts       # User schema (nexId, phone/email, otp, etc.)
│   │   ├── Message.ts    # Message schema (chatId, sender, type, content)
│   │   └── Chat.ts       # Chat schema (direct/group)
│   ├── routes/
│   │   ├── index.ts      # Route barrel + serves frontend at /api/app
│   │   ├── auth.ts       # POST /api/auth/send-otp, /api/auth/verify-otp
│   │   ├── users.ts      # GET/PUT /api/users/me, search by nexId
│   │   ├── chats.ts      # Chat CRUD + messages
│   │   └── upload.ts     # POST /api/upload (multipart)
│   ├── middlewares/
│   │   └── auth.ts       # JWT bearer auth middleware
│   └── lib/
│       ├── database.ts   # MongoDB connection
│       └── helpers.ts    # NexID/OTP/ChatID generators
├── public/
│   └── index.html        # Full SPA frontend
└── uploads/              # Uploaded files stored here

lib/api-spec/openapi.yaml # OpenAPI spec (health only, NexChat uses custom routes)
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/send-otp | No | Request OTP |
| POST | /api/auth/verify-otp | No | Verify OTP, get token |
| GET | /api/users/me | Yes | My profile |
| PUT | /api/users/me | Yes | Update profile |
| GET | /api/users/search/:nexId | Yes | Find user by NexID |
| GET | /api/chats | Yes | List my chats |
| POST | /api/chats/direct | Yes | Start 1-on-1 chat |
| POST | /api/chats/group | Yes | Create group |
| GET | /api/chats/:chatId/messages | Yes | Get messages |
| POST | /api/upload | Yes | Upload file/image |

## Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| message:send | Client→Server | Send message |
| message:new | Server→Client | New message broadcast |
| typing:start/stop | Both | Typing indicator |
| user:status | Server→Client | Online/offline update |
| messages:read | Both | Mark as read |

## Environment Variables (Secrets)

- `MONGODB_URI` — MongoDB Atlas connection string
- `JWT_SECRET` — JWT signing secret
- `PORT` — Assigned automatically by Replit

## Important: MongoDB Atlas IP Whitelist

MongoDB Atlas requires whitelisting the server IP. In Atlas dashboard:
- Network Access → Add IP Address → Allow Access from Anywhere (0.0.0.0/0)

## Frontend Access

Frontend is served at `/api/app` (redirect from `/api/`)

## Dev OTP

In development (NODE_ENV=development), the API returns the OTP in the response body as `devOtp` for easy testing.
