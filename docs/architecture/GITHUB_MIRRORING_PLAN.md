# GitHub Mirroring Plan: Fallback Source of Truth

## Overview
Soupz is designed to be a "Local-First, Cloud-Synced" IDE. The primary source of truth is the user's local machine (via the `soupz` daemon). However, to enable "edit from anywhere" even when the home machine is asleep or offline, we implement **GitHub Mirroring**.

This document outlines the strategy for using GitHub as a fallback source of truth, handling edge cases related to synchronization, unpushed changes, and multi-device conflicts.

## 1. Core Architecture

### 1.1 Source of Truth Hierarchy
1.  **Local Daemon (Primary)**: Full access to FS, Git, and Shell.
2.  **GitHub Repository (Fallback)**: Read-only (or limited write via API) access to the latest pushed state.
3.  **Supabase Shadow State (Bridge)**: Stores metadata about local "dirty" state (unpushed changes, uncommitted lines).

### 1.2 State Synchronization Loop
- **Daemon-side**: 
    - On every file change or every 30 seconds, the daemon pushes a "Shadow Manifest" to Supabase.
    - **Manifest includes**: Current branch, HEAD commit hash, list of modified/added/deleted files, and (optionally) small unified diffs for uncommitted changes.
- **Web-side**:
    - Periodically checks daemon health.
    - If daemon is `offline`, it switches the `FileSystemProvider` to `GitHub`.
    - It uses the "Shadow Manifest" from Supabase to "decorate" the GitHub file tree.

## 2. Edge Case Analysis

### 2.1 Uncommitted Local Changes
**Problem**: User edited 10 lines locally but didn't commit or push. Daemon goes offline.
**Plan**:
- The daemon syncs "uncommitted diffs" to Supabase `soupz_shadow_diffs` table.
- When the web app fetches the file from GitHub, it applies these diffs (using a library like `diff-match-patch`) to reconstruct the "Local-but-Unpushed" version.
- **UX**: Show a "Local (Offline)" badge on the file.

### 2.2 Pushed vs. Unpushed Commits
**Problem**: User committed changes but didn't push to GitHub.
**Plan**:
- The "Shadow Manifest" contains the local `HEAD` hash.
- Web app compares local `HEAD` with GitHub's `default_branch` hash.
- If they differ, the web app notifies the user: "You have 2 unpushed commits on your local machine. These are not visible in Fallback Mode."
- **Advanced**: We could potentially sync the entire `.git/objects` for small commits to Supabase, but for V1, we simply warn the user.

### 2.3 New Files / "New Coders"
**Problem**: New files created locally but not yet tracked or pushed.
**Plan**:
- Untracked files are listed in the Shadow Manifest.
- If the file doesn't exist on GitHub, the web app attempts to fetch the content from Supabase `soupz_shadow_files` (where the daemon should have uploaded a copy).

### 2.4 Multiple Devices Editing Simultaneously
**Problem**: User edits on Phone (via GitHub Fallback) while Laptop (Daemon) is offline. Then Laptop comes online.
**Plan**:
- **GitHub-centric**: If the user has GitHub write access, edits made in Fallback mode are committed directly to a new branch (e.g., `soupz-patch-[timestamp]`) or pushed to the current branch.
- **Cloud-Patching**: If no write access, edits are saved to Supabase as "Pending Patches".
- **Reconciliation**: When the daemon comes back online, it detects "Pending Patches" in Supabase and prompts the user to apply/merge them.

## 3. Implementation Specification

### 3.1 Database Schema (Supabase)
```sql
-- Track the state of a local workspace
create table soupz_shadow_manifest (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users,
  machine_id text,
  branch_name text,
  head_sha text,
  dirty_files jsonb, -- [{path: "src/app.js", status: "modified"}]
  last_sync timestamp with time zone default now()
);

-- Store small diffs for uncommitted changes
create table soupz_shadow_diffs (
  id uuid primary key default uuid_generate_v4(),
  manifest_id uuid references soupz_shadow_manifest,
  file_path text,
  diff_text text,
  base_sha text
);
```

### 3.2 Logic Flow: "The Offline Handshake"
1.  **Detection**: `App.jsx` notices `daemonOnline` is `false`.
2.  **Fetch Manifest**: Fetch the latest `soupz_shadow_manifest` for the current user.
3.  **UI Decoration**: 
    - Files in `dirty_files` get an orange "dirty" dot.
    - Files not on GitHub but in `dirty_files` (status: 'added') are shown in the tree.
4.  **File Read**:
    - User clicks `src/index.js`.
    - System checks if `src/index.js` has a shadow diff.
    - If YES: Fetch base from GitHub API -> Apply Diff -> Show in Editor.
    - If NO: Fetch from GitHub API -> Show in Editor (Read-Only).

## 4. Risks & Mitigations
- **Large Diffs**: If a diff is too large (>1MB), don't sync to Supabase. Just mark as "Out of Sync".
- **Binary Files**: Don't attempt to diff or shadow binary files.
- **Security**: Shadow diffs contain source code. They must be encrypted or strictly RLS-protected in Supabase.
- **Stale Manifests**: If a manifest is older than 1 hour, warn the user that the "Local State" might be outdated.

## 5. Success Metrics
- User can view the "latest" version of their code (including last saved local changes) even when their laptop is closed.
- Zero data loss when transitioning from Offline (Fallback) to Online (Daemon) mode.
