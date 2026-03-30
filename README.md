# Break Cash

Official web application for Break Cash, built with a React/Vite frontend and an Express backend.

## Overview

- Frontend: React 19 + Vite
- Backend: Express
- Auth: JWT
- Database: PostgreSQL in production, SQLite for local fallback scenarios
- Monitoring: Sentry support for frontend and backend
- Installability: PWA manifest, icons, and service worker included

## Local Development

1. Create `.env` from `.env.example`
2. Install dependencies:
   - `npm install`
3. Start the API server:
   - `npm run dev:server`
4. Start the frontend:
   - `npm run dev`

## Production Build

- Build the frontend:
  - `npm run build`
- Start the production server:
  - `npm run start:prod`

## Required Environment Variables

- `DATABASE_URL`
- `JWT_SECRET`
- `OWNER_EMAIL`
- `OWNER_PASSWORD`

## Optional Integrations

### Sentry

- Backend:
  - `SENTRY_DSN`
  - `SENTRY_TRACES_SAMPLE_RATE`
- Frontend:
  - `VITE_SENTRY_DSN`
  - `VITE_SENTRY_TRACES_SAMPLE_RATE`

### Password Reset Delivery

- Twilio:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_FROM_NUMBER`
- SMTP:
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_USER`
  - `SMTP_PASS`
  - `SMTP_FROM`

### Health Checks

- `GET /api/health/live`
- `GET /api/health/ready`
- `GET /api/health`
- `GET /api/health/ping`

If `UPTIME_PING_TOKEN` is set, call:

- `/api/health/ping?token=YOUR_TOKEN`
