# Installation Guide for Soupz-Stall

## Quick Install

### Option 1: NPM (Recommended)
```bash
npm install -g soupz-stall
soupz-stall
```

### Option 2: From Source
```bash
git clone https://github.com/yourusername/soupz-agents.git
cd soupz-agents
npm install
npm link
soupz-stall
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
2. ✅ Imports personas to Kiro/BMAD
3. ✅ Sets up memory shards
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
/bmad-agent-soupz-designer
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
cp bmad-export/*.md ~/.bmad/custom/
```

---

