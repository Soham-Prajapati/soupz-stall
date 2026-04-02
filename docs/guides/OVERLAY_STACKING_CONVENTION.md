# Overlay Stacking Convention

Updated: 2026-04-02

This document defines a single z-index scale for dashboard overlays to avoid mobile layering collisions.

## Canonical Constants

Source of truth: `packages/dashboard/src/lib/overlayZ.js`

- `setupWizard`: `100`
- `modal`: `120`
- `toast`: `130`
- `commandPalette`: `140`
- `folderPicker`: `200`

## Usage Rule

Always import `OVERLAY_Z` and set `style={{ zIndex: OVERLAY_Z.<layer> }}` on fixed overlay roots.
Do not introduce ad-hoc `z-[NNN]` values for new overlays.

## Existing Components Migrated

- `packages/dashboard/src/components/shared/SetupWizard.jsx`
- `packages/dashboard/src/components/shared/PairingCodeModal.jsx`
- `packages/dashboard/src/components/shared/KeyboardShortcuts.jsx`
- `packages/dashboard/src/components/shared/NotificationToast.jsx`
- `packages/dashboard/src/components/shared/CommandPalette.jsx`
- `packages/dashboard/src/components/shared/FolderPicker.jsx`

## Mobile Verification Targets

Validate on:

- width `360`
- width `390`
- width `430`

Checks:

- Command palette stays above toasts and status bar.
- Toasts remain visible while modal backdrops are active.
- Folder picker remains highest-priority blocking modal.
- Setup wizard backdrop blocks pointer events behind it.
