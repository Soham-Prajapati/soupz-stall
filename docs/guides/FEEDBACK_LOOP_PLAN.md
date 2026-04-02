# External Feedback Loop Plan

*Updated: April 3, 2026*

This document outlines the strategy for gathering and processing external feedback to improve Soupz Cockpit.

## 📡 Channels

### 1. Discord Community
- **Purpose**: Real-time support, feature requests, and community building.
- **Action**: Create a `#feedback-and-ideas` channel.
- **Action**: Use a Discord bot to mirror GitHub Releases and critical issues.

### 2. GitHub Issues Triage
- **Purpose**: Bug tracking and formal feature requests.
- **Protocol**: 
  - Every issue must be labeled (`bug`, `feature`, `dx`, `ux`).
  - Weekly triage session to prioritize the backlog.
  - Use "Issue Templates" to ensure high-quality reports.

### 3. Review Mining Automation
- **Purpose**: Proactively find pain points from similar tools (e.g., Cursor, Windsurf, Aider).
- **Automation**: 
  - Use `soupz-review-miner` agent to scrape Reddit, Twitter, and Hacker News for mentions of AI IDEs.
  - Summarize monthly "Competitive Friction Report" to inform our roadmap.

---

## 🔄 Feedback Loop Process

1. **Capture**: Feedback arrives via Discord/GitHub/Reviews.
2. **Classify**: Identify if it's a **friction point**, **bug**, or **feature request**.
3. **Analyze**: Use `soupz-analyst` to correlate feedback with our internal usage instrumentation (`soupz_telemetry_events`).
4. **Prioritize**: Add to `tasks.md` or `LOGIC_PENDING_TODO.md` based on impact vs effort.
5. **Close the Loop**: Inform the user when their feedback has been addressed (e.g., tag them in the release notes).

---

## 🛠️ Automation & Tools

- **`scripts/gather-feedback.js`**: A script to pull recent mentions from configured sources.
- **`defaults/agents/review-miner.md`**: Specialized agent prompt for analyzing competitive sentiment.
- **`packages/dashboard/src/lib/instrumentation.js`**: Client-side event tracking to validate if reported friction points are statistically significant.
