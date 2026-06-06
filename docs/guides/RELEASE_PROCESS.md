# Release Process & Convention

*Updated: April 3, 2026*

This document defines the release workflow for the Soupz Cockpit.

## 🏁 Enforce PR-Only Deploy Path
Direct pushes to the `main` branch are prohibited. All code must enter `main` via a Pull Request (PR) that has passed all CI checks.

1. **Feature Development**: Done on `feat/*` or `fix/*` branches.
2. **Merging**: PR into `main`. CI must pass.
3. **Release Branching**: Create a `release/vX.Y.Z` branch from `main`.
4. **Final Smoke Test**: Run `./scripts/pre-deploy-smoke.sh` on the release branch.
5. **Merging to Main**: Merge the release branch back to `main` and tag it.

---

## 🏗️ Release Branch Convention (`release/*`)

- **Name Pattern**: `release/v<major>.<minor>.<patch>` (e.g., `release/v0.3.0`).
- **Hotfixes**: Create a `hotfix/vX.Y.Z-patch` branch from `main` or the current release tag. Merge into `main` and back to the current development branch.

---

## 🧪 Pre-Deploy Smoke Command
Before any production deployment (Vercel or npm), run:
```bash
./scripts/pre-deploy-smoke.sh
```

### What it checks:
1. **Dashboard Build**: Ensures the React app builds without errors.
2. **Daemon Syntax**: Uses `node --check` to verify the remote-server entry point.
3. **Critical Tests**: Runs `vitest` for pairing and filesystem APIs.
4. **Documentation Links**: Verifies that `docs/INDEX.md` and other references are valid.

---

## ⏪ Rollback Note
If a release fails in production:
1. **Identify the failure**: Check Vercel logs or GitHub Actions output.
2. **Revert the merge**: Use `git revert -m 1 <merge-commit-hash>` to revert the PR merge into `main`.
3. **Redeploy**: Trigger a manual redeploy from the previous stable tag on Vercel.
4. **Post-Mortem**: Document the failure in `docs/RUNTIME_CHANGELOG.md` and fix it on a new `fix/*` branch.
