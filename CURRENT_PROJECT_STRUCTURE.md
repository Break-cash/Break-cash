# Current Project Structure

This file documents the current on-disk project structure as it exists now.

Notes:
- Excludes `.git` and `node_modules` to keep the view readable.
- Reflects the current workspace state, not the full historical repository layout.
- The current workspace is a partial working tree: compiled frontend assets exist in `dist/`, but most source files are not present on disk right now.

```text
breakcash.cash/
|-- .vercel/
|-- dist/
|   |-- assets/
|   |   |-- AccessDenied-BLiQ9K-m.js
|   |   |-- AdminBalancesPage-DSafCzec.js
|   |   |-- AdminDashboardPage-BBkFw0i7.js
|   |   |-- AdminInvitesPage-CDtOlLYG.js
|   |   |-- AdminPermissionsPage-DifJcpb5.js
|   |   |-- AdminUsersPage-gYyyeJnH.js
|   |   |-- Assets-Z85F0H9S.js
|   |   |-- charts-B96ycc4G.js
|   |   |-- DepositPage-BUHX-OQc.js
|   |   |-- FriendsPage-Dca7SvpM.js
|   |   |-- FuturesPage-BPOlxcKQ.js
|   |   |-- Home-BHn15_RD.js
|   |   |-- index-B6O3O7eE.css
|   |   |-- index-D2QiZjJW.js
|   |   |-- JoinInvite-BNXyY9CW.js
|   |   |-- Market-Ctp78Cle.js
|   |   |-- MiningPage-BZgSJqkB.js
|   |   |-- Options-t04a8jFZ.js
|   |   |-- OwnerDashboardPage-EuYDH31z.js
|   |   |-- OwnerPremiumDashboardPage-bgQ6IKUa.js
|   |   |-- ProfilePage-ju_sdsxF.js
|   |   |-- react-DEPPQZgv.js
|   |   |-- SyncTrade-DZAUBeej.js
|   |   `-- WatchlistPage-FknaBLuA.js
|   |-- break-cash-logo-premium.png
|   |-- index.html
|   |-- manifest.json
|   |-- sw.js
|   `-- vite.svg
|-- server/
|   `-- index.js
|-- .env
|-- .env.example
|-- .gitignore
|-- .vercel-trigger.txt
|-- deploy.ps1
|-- eslint.config.js
|-- index.html
`-- package.json
```

## What The Current Structure Means

- `package.json`
  - Defines a Vite + React frontend plus a Node/Express backend start command.
  - Active scripts show the intended flow:
    - `npm run build` for frontend build
    - `npm start` for backend startup through `server/index.js`

- `server/index.js`
  - This is the currently available backend entrypoint.
  - It boots an Express API, enables CORS and JSON parsing, serves `/uploads`, and exposes health endpoints:
    - `/api/health/live`
    - `/api/health/ping`
    - `/api/health/ready`
    - `/api/health`
  - It also attempts to register routers for:
    - auth
    - invites
    - permissions
    - users
    - balance
    - profile
    - notifications
    - settings
    - portfolio
    - market
    - stats
    - friends
  - In production mode it serves the frontend build from `dist/`.

- `dist/`
  - Contains a built frontend bundle, not source code.
  - The generated asset names indicate the frontend previously included pages/modules such as:
    - Home
    - Market
    - Assets
    - DepositPage
    - FriendsPage
    - FuturesPage
    - JoinInvite
    - MiningPage
    - Options
    - ProfilePage
    - SyncTrade
    - WatchlistPage
    - Admin pages
    - Owner dashboard pages

- `.vercel/`
  - Local Vercel link metadata for the current folder.

- `deploy.ps1`
  - Local deployment helper script for PowerShell-based deployment flow.

- `index.html`
  - Frontend HTML entry file for the Vite app.

- `.env` and `.env.example`
  - Runtime and example environment variable definitions.

## Current State Summary

- Present now:
  - frontend build output
  - backend entrypoint
  - deployment metadata
  - package manifest
  - environment/config files

- Missing from the current on-disk tree:
  - most frontend source under `src/`
  - most backend modules under `server/routes`, `server/services`, and `server/db`
  - TypeScript config files
  - additional build config files that existed historically

- Practical implication:
  - the folder currently looks like a partially reduced deployment-oriented copy rather than a full editable source tree.
