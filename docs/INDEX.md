# Soupz Documentation Index

*Last Updated: April 3, 2026*

Welcome to the **Soupz Stall** (also known as **Soupz Cockpit**) documentation. This index serves as the single canonical source of truth for navigating the project's documentation.

---

## 🏗️ Core Architecture & System
*The "how it works" and foundational knowledge.*

- **[System Architecture](architecture/SYSTEM_ARCHITECTURE.md)**: High-level topology, component responsibilities, and request lifecycles. **(Primary Reference)**
- **[Current Runtime Reference](CURRENT_SYSTEM.md)**: Specifics on orchestration, interactive flows, and current UX rules.
- **[Project Overview](../PROJECT_OVERVIEW.md)**: High-level goals, tech stack, and project structure.
- **[Audit & USP](../AUDIT_AND_USP.md)**: A brutally honest audit of the project's state and its unique selling points.

---

## 🚀 Getting Started & Setup
*For new developers and users.*

- **[Quick Start & Setup](SETUP.md)**: Environment variables, dependencies, and how to run the project.
- **[Release Process & Convention](guides/RELEASE_PROCESS.md)**: *(New)* PR-only deploys, release branches, and smoke tests.
- **[Core Demo Script](CORE_DEMO_SCRIPT.md)**: A structured script for performing a 5-minute demo of Soupz.
- **[NPM Publishing Guide](NPM_PUBLISH.md)**: Procedures for building and publishing the `soupz-cockpit` package.

---

## 🛠️ Guides & Best Practices
*Deep dives into specific areas of the system.*

- **[Model Selection & Grading](guides/MODEL_SELECTION_AND_GRADING.md)**: How agents are chosen and how their output is evaluated.
- **[Troubleshooting Matrix](guides/TROUBLESHOOTING_MATRIX.md)**: *(New)* Provider-specific issues and common resolutions.
- **[External Feedback Loop Plan](guides/FEEDBACK_LOOP_PLAN.md)**: *(New)* Strategy for community engagement and market feedback.
- **[Claim Policy (5x/10x Efficiency)](guides/CLAIM_POLICY.md)**: *(New)* Requirements for efficiency and speedup claims.
- **[Owner Action Checklist](guides/OWNER_ACTION_CHECKLIST.md)**: Critical tasks for project owners.
- **[Overlay Stacking Convention](guides/OVERLAY_STACKING_CONVENTION.md)**: Z-index and layout rules for mobile and desktop.
- **[Keyboard Parity Guide](guides/KEYBOARD_PARITY.md)**: Standards for keyboard shortcuts across different platforms.

---

## 📈 Changelog & Progress
*Tracking the evolution of the project.*

- **[Runtime Changelog](RUNTIME_CHANGELOG.md)**: Date-stamped entries of shipped behavior changes.
- **[Logic Pending TODO](../LOGIC_PENDING_TODO.md)**: Detailed tracking of core logic implementation.
- **[Tasks Tracking](../tasks.md)**: High-level task list and status.
- **[Terminal Tasks](../TODO_TERMINALS.md)**: Sprint-specific parallel task tracking for multi-agent workflows.

---

## 🧪 Testing & Quality
*Ensuring stability and performance.*

- **[Edge Case Testing](../tests/EDGE_CASES.md)**: Comprehensive list of manual and automated test scenarios.
- **[Production E2E User Flow](guides/PRODUCTION_E2E_USER_FLOW.md)**: Mapping the critical user paths for validation.

---

## 🎨 Branding & Identity
- **[Naming Ideas](NAMING_IDEAS.md)**: Evolution of the project's name and branding shortlist.

---

## 📂 Historical & Reference
- **[Architecture Archive](architecture/)**
- **[Guides Archive](guides/)**
- **[Agent Reference](agents/)**
- **[Research Notes](research/)**

---

### Documentation Policy
1. **Update `INDEX.md`** whenever a new documentation file is added or renamed.
2. **Update `SYSTEM_ARCHITECTURE.md`** when core runtime behavior or topology changes.
3. **Add date-stamped entries** to `RUNTIME_CHANGELOG.md` for all shipped features.
4. **Prefer surgical updates** to existing docs over creating new files with overlapping content.
