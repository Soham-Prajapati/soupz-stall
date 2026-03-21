# Soupz - Roadmap & Next Steps

## ✅ Recently Completed
- **Admin Command Center:** Role-based access for Soham/Shubh to view system users and analytics.
- **Hardened Security:** Enabled RLS on all Supabase tables with strict user ownership policies.
- **Multi-Level Leaderboard:** Added Global, Friends, and College filters.
- **Weekly Challenges:** Interactive quest system for earning XP.
- **Premium Usage UI:** Detailed tracking of agent calls and allowance percentages.
- **Local Connection Fix:** Dashboard now automatically connects to local daemon without tokens.
- **Syntax Fixes:** Resolved backend boot errors and sidebar scrolling constraints.

## 🚀 PENDING - High Priority

### 1. Supabase Profiles & Real Leaderboard
```
Currently leaderboard uses mock community data.
1. Create 'soupz_profiles' table: id (uuid), display_name, avatar_url, xp, level, streak.
2. In App.jsx, after login, upsert the user's data to Supabase.
3. Update LeaderboardPanel.jsx to fetch top 100 users from Supabase.
```

### 2. Real-Time File Execution
```
The 'Run' button in ProMode is wired to the daemon but lacks a full runtime bridge.
1. Implement /api/exec in backend to spawn node/python/etc.
2. Capture stdout/stderr and stream back to the dashboard terminal.
```

### 3. Split Editor Support
```
In ProMode.jsx, add support for side-by-side Monaco instances.
- Track independent scroll/cursor state for both panes.
- Allow dragging files into left or right pane.
```

### 4. Settings Persistence
```
Editor settings (ligatures, word wrap) currently reset on refresh.
- Store in Supabase 'soupz_settings' linked to user ID.
```

### 5. Proper Landing Page (Conversion Focus)
```
LandingPage.jsx needs a visual upgrade to look premium.
- Add animated hero section with floating terminal UI.
- Add "Install with npx" one-liner prominently.
```

---

## Architecture Notes
- Frontend: React 18 + Vite (`packages/dashboard`)
- Backend: Node.js ESM (`packages/remote-server`)
- DB: Supabase with strict RLS (enabled March 21, 2026)
- Port: 7533
