# BREAK CASH Web

Trading web app with React/Vite frontend and Express/PostgreSQL backend.

## Run locally

1. Create `.env` from `.env.example`.
2. Install dependencies:
   - `npm install`
3. Start API:
   - `npm run dev:server`
4. Start frontend:
   - `npm run dev`

## Required environment variables

- `DATABASE_URL`
- `JWT_SECRET`
- `OWNER_EMAIL`
- `OWNER_PASSWORD`

## Optional production integrations

### 1) Sentry (errors + tracing)

- Backend:
  - `SENTRY_DSN`
  - `SENTRY_TRACES_SAMPLE_RATE` (e.g. `0.1`)
- Frontend:
  - `VITE_SENTRY_DSN`
  - `VITE_SENTRY_TRACES_SAMPLE_RATE` (e.g. `0.1`)

Notes:
- Backend captures uncaught route/bootstrap errors.
- Frontend captures runtime errors and API 5xx signals.

### 2) Password reset delivery channels

- SMS (Twilio):
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_FROM_NUMBER`
- Email (SMTP):
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_USER`
  - `SMTP_PASS`
  - `SMTP_FROM`

If these values are not provided, reset delivery falls back to `mock` mode in development.

### 3) Uptime monitoring probes

Available health endpoints:
- `GET /api/health/live` (process liveness)
- `GET /api/health/ready` (DB readiness)
- `GET /api/health` (DB latency + uptime)
- `GET /api/health/ping` (optional token-guarded monitor endpoint)

Optional token guard:
- Set `UPTIME_PING_TOKEN`
- Probe URL: `/api/health/ping?token=YOUR_TOKEN`
