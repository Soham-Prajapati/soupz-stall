# Installation Guide for Soupz CLI

## Quick Install

### Option 1: NPM (Recommended)
```bash
# Using NPM
npm install -g soupz-cli
```

Once installed, you can start the daemon from any directory:

```bash
soupz-cli
```

## Running without Installation

If you don't want to install it globally, you can run it on-demand:

```bash
npx soupz-cli
```

### Option 3: Homebrew

There is no supported Homebrew formula yet. Use `npm install -g soupz-cli` or `npx soupz-cli`.

---

## For Your Friends

### Share via NPM
```bash
# Publish to npm
npm login
npm publish

# Friends install
npm install -g soupz-cli
```

### Share via GitHub
```bash
# Friends install
npm install -g github:soupz/cli
```

---

## Auto-Setup

On first run, Soupz CLI automatically:
1. ✅ Creates config directories
2. ✅ Imports personas to Kiro/SOUPZ
3. ✅ Sets up memory banks
4. ✅ Initializes cost tracking

No manual setup needed!

---

## Verify Installation

```bash
# Check version
soupz-cli --version

# Check personas
soupz-cli
/personas

# Check Kiro integration
/soupz-agent-soupz-designer
```

---

## Uninstall

```bash
npm uninstall -g soupz-cli
rm -rf ~/.soupz-cli
```

---

## Troubleshooting

### Command not found
```bash
# Re-link
cd /path/to/cli
npm link
```

### Personas not imported
```bash
# Manual import
cp soupz-export/*.md ~/.soupz/custom/
```

---
