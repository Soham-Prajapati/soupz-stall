# Soupz Deployment Split

Date: 2026-03-16
Status: current recommended production setup.

## Short Answer

Frontend dashboard can be hosted on Vercel.

Current backend should not be hosted on Vercel in its present form.

## Why Frontend Works on Vercel

`packages/dashboard` is a Vite static app.

That means it can be built to static assets and served by Vercel without issue.

## Why Backend Does Not Cleanly Fit Vercel

`packages/remote-server/src/index.js` currently depends on:

- long-running Node process state
- WebSocket server lifecycle
- terminal spawning via `node-pty`
- local machine / repository access
- persistent in-memory order state

These are not a good fit for Vercel serverless functions or edge functions.

The current backend is a workstation-side runtime bridge, not a stateless cloud API.

## Recommended Hosting Setup

### Option A: ship now
- Frontend: Vercel
- Backend: Railway or Render

### Option B: bigger refactor later
- Frontend: Vercel
- Backend: redesign into stateless API + queue/worker split

Only after that refactor would a Vercel-hosted API become realistic for some routes.

## Frontend Vercel Environment Variable

Set this in the Vercel project for the dashboard:

```bash
VITE_SOUPZ_REMOTE_URL=https://YOUR_BACKEND_HOST
```

Example:

```bash
VITE_SOUPZ_REMOTE_URL=https://soupz-remote-server.up.railway.app
```

## Dashboard Deploy Root

Use `packages/dashboard` as the Vercel project root.

Relevant config file:

- `packages/dashboard/vercel.json`

## Deploy Commands

From repo root:

```bash
cd packages/dashboard
vercel
vercel --prod
```

## Backend Follow-Up

If you want cloud-only usage with no local `pnpm run dev`, the next real step is moving the remote server to Railway/Render and pointing the Vercel dashboard at that public backend URL.