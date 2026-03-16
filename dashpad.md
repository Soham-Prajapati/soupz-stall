# Dashpad Asset Tracker

This file tracks generated visual assets for Soupz Stall.

## How To Use This File (Required)
1. Generate image using Theme A top-down prompt unless explicitly experimenting.
2. Save image in correct `images/` subfolder.
3. Name file using canonical format:
	`[mode]-[family]-[asset]-[variant]-v[major].[minor].png`
4. Add/update the same file in `images/manifest.json`.
5. Mark checkbox here.
6. Add a notes log line with date + model/source.

## Current Visual Direction
- World: open food-stall yard (3 to 4 stalls)
- Production perspective: strict top-down
- Export background: neon green #00FF00 (chroma)
- Isometric: optional experimental branch only

## Asset Completion Checklist

### Stalls
- [ ] td-stall-burger-shell-day-v1.0.png
- [ ] td-stall-taco-shell-day-v1.0.png
- [ ] td-stall-juice-shell-day-v1.0.png
- [ ] td-stall-dessert-shell-day-v1.0.png

### Yard and Tiles
- [ ] td-yard-base-plate-main-v1.0.png
- [ ] td-tile-road-footpath-main-v1.0.png
- [ ] td-decal-ground-markers-set-a-v1.0.png

### Workspaces
- [ ] td-workspace-fry-main-v1.0.png
- [ ] td-workspace-dessert-main-v1.0.png
- [ ] td-workspace-beverage-main-v1.0.png
- [ ] td-workspace-chop-main-v1.0.png
- [ ] td-workspace-serving-pass-main-v1.0.png

### Props and Tools
- [ ] td-prop-queue-barriers-set-a-v1.0.png
- [ ] td-prop-bin-set-set-a-v1.0.png
- [ ] td-prop-bench-table-set-a-v1.0.png
- [ ] td-prop-planter-set-a-v1.0.png
- [ ] td-prop-string-lights-set-a-v1.0.png
- [ ] td-sheet-utensils-core-main-v1.0.png
- [ ] td-sheet-cookware-core-main-v1.0.png
- [ ] td-sheet-ingredient-bins-main-v1.0.png
- [ ] td-sheet-ticket-timer-status-main-v1.0.png

### Characters
- [ ] td-sprite-orchestrator-head-chef-day-v1.0.png
- [ ] td-sprite-fry-cook-day-v1.0.png
- [ ] td-sprite-dessert-cook-day-v1.0.png
- [ ] td-sprite-cashier-day-v1.0.png
- [ ] td-sprite-manager-day-v1.0.png

### Optional Isometric
- [ ] iso-stall-burger-shell-main-v0.1.png
- [ ] iso-yard-base-plate-main-v0.1.png

## Update Rule
After generating any image:
1. Save to the correct folder under `images/`
2. Add/replace entry in `images/manifest.json`
3. Mark checkbox above
4. Add short note with date and source model

## Naming Examples
- `td-stall-burger-shell-day-v1.0.png`
- `td-workspace-fry-main-v1.0.png`
- `td-prop-queue-barriers-set-a-v1.0.png`
- `td-sheet-utensils-core-main-v1.0.png`
- `td-sprite-manager-day-v1.0.png`
- `iso-stall-burger-shell-main-v0.1.png` (experimental only)

## Cross References
- Prompt pack: `_bmad-output/planning-artifacts/kitchen-ui-component-prompt-pack.md`
- Image root guide: `images/README.md`
- Agent context: `docs/guides/PROJECT_AGENT_CONTEXT_FULL.md`

## Notes Log
- 2026-03-16: Folder tree initialized for assets.
