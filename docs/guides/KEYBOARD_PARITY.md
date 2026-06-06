# Keyboard Parity Guide

Updated: 2026-04-02

This guide defines the expected shortcut behavior across macOS and Windows/Linux.

## Canonical Mappings

- Mode switch (browser-safe): `Alt+1`, `Alt+2`, `Alt+3`
- Mode switch fallback: `Cmd+Shift+1/2/3` on macOS, `Ctrl+Shift+1/2/3` on Windows/Linux
- Command palette: `Cmd+K` or `Cmd+Shift+P` on macOS, `Ctrl+K` or `Ctrl+Shift+P` on Windows/Linux
- Open folder picker: `Cmd+O` on macOS, `Ctrl+O` on Windows/Linux
- Keyboard overlay: `Cmd+/` or `Cmd+Shift+K` on macOS, `Ctrl+/` or `Ctrl+Shift+K` on Windows/Linux

## Validation Checklist

- Trigger every command with the expected primary key (`Cmd` on macOS, `Ctrl` on Windows/Linux).
- Confirm browser-safe alternates (`Alt+1/2/3`) still work regardless of platform.
- Verify `Esc` closes command palette, setup modal, pairing modal, and shortcuts overlay.
- Confirm shortcut labels in the keyboard modal display platform-specific keys.

## Implementation Surfaces

- Runtime bindings: `packages/dashboard/src/App.jsx`
- Shortcut labels UI: `packages/dashboard/src/components/shared/KeyboardShortcuts.jsx`
