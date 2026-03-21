# 🚀 Publishing & Hosting Guide

This guide explains how to publish the `soupz` CLI to NPM and host the IDE on Vercel.

## 1. NPM Publishing (The CLI)

The CLI allows users to run `npx soupz` to start the local daemon.

### Prerequisites
- An active account on [npmjs.com](https://www.npmjs.com/)
- Logged in via terminal: `npm login`

### Steps to Publish
1. **Root Directory:** Ensure you are in the project root (`soupz-agents`).
2. **Version Check:** Update `"version"` in `package.json` if you've made changes.
3. **Publish:**
   ```bash
   npm publish
   ```
4. **Test:** In a separate terminal, try running:
   ```bash
   npx soupz
   ```

---

## 2. Vercel Hosting (The Web IDE)

The web dashboard is a React app that needs to be hosted online.

### Prerequisites
- [Vercel CLI](https://vercel.com/cli) installed or a Vercel account linked to GitHub.

### Setup (Manual UI)
1. Go to [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New** > **Project**.
3. Import the `soupz-agents` repository.
4. **Root Directory:** Select `packages/dashboard`.
5. **Framework Preset:** Vite.
6. **Environment Variables (CRITICAL):**
   Add these two variables so your live site can talk to Supabase:
   - `VITE_SUPABASE_URL` = `https://your-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your-anon-public-key`
7. Click **Deploy**.

---

## 3. Post-Publish Checklist
- [ ] Run `npx soupz` on your local machine to verify the daemon starts.
- [ ] Open the Vercel URL and verify you can log in with Google/GitHub.
- [ ] Check the "Admin Command Center" (Shield icon in top right) if logged in as Soham/Shubh.
- [ ] Verify the file explorer auto-loads your local files.
