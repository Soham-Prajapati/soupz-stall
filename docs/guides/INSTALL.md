# Installation Guide for Soupz-Stall

## Quick Install

### Option 1: NPM (Recommended)
```bash
# Using NPM
npm install -g @shubh_prajapati99/soupz
```

Once installed, you can start the daemon from any directory:

```bash
soupz
```

## Running without Installation

If you don't want to install it globally, you can run it on-demand:

```bash
npx @shubh_prajapati99/soupz
```

### Option 3: Homebrew (Coming Soon)
```bash
brew tap yourusername/soupz
brew install soupz-stall
soupz-stall
```

---

## For Your Friends

### Share via NPM
```bash
# Publish to npm
npm login
npm publish

# Friends install
npm install -g soupz-stall
```

### Share via GitHub
```bash
# Friends install
npm install -g github:yourusername/soupz-agents
```

---

## Auto-Setup

On first run, Soupz-Stall automatically:
1. ✅ Creates config directories
2. ✅ Imports personas to Kiro/SOUPZ
3. ✅ Sets up memory banks
4. ✅ Initializes cost tracking

No manual setup needed!

---

## Verify Installation

```bash
# Check version
soupz-stall --version

# Check personas
soupz-stall
/personas

# Check Kiro integration
/soupz-agent-soupz-designer
```

---

## Uninstall

```bash
npm uninstall -g soupz-stall
rm -rf ~/.soupz-agents
```

---

## Troubleshooting

### Command not found
```bash
# Re-link
cd /Users/shubh/Developer/soupz-agents
npm link
```

### Personas not imported
```bash
# Manual import
cp soupz-export/*.md ~/.soupz/custom/
```

---

