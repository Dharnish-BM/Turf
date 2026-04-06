# Mini-IPL Turf Cricket Management System

This repository now contains:

- `frontend/` - React + Vite client
- `backend/` - Node.js + Express + MongoDB + Socket.IO server

## Features Implemented

- JWT authentication (`/api/auth/login`, `/api/auth/register-admin`)
- Role-aware player management APIs (`/api/players`)
- Match creation, toss and ball-by-ball scoring endpoints (`/api/matches`)
- Real-time auction engine using Socket.IO rooms and events
- Dynamic leaderboard aggregation (`/api/leaderboard`)
- Single-page React dashboard for players, matches, auction, scoring, and leaderboard

## Backend Setup

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

`backend/.env` values:

- `PORT` (default `5000`)
- `MONGO_URI` (default `mongodb://127.0.0.1:27017/turf-cricket`)
- `JWT_SECRET`
- `CORS_ORIGIN` (default `http://localhost:5173`)

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Optional client env:

- `VITE_API_URL` (default `http://localhost:5000/api`)
- `VITE_SOCKET_URL` (default `http://localhost:5000`)

## First-Time Flow

1. Start MongoDB and backend.
2. Register an admin using `POST /api/auth/register-admin`.
3. Login from the frontend with admin credentials.
4. Add players and captains.
5. Create match in manual or auction mode.
6. Run live auction and score ball-by-ball.
