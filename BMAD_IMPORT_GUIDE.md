# Importing Soupz Personas into BMAD

## Overview

BMAD (Build-Measure-Adapt-Deploy) uses a different agent format than Soupz. This guide shows how to convert Soupz personas to BMAD custom agents.

---

## Format Comparison

### Soupz Format
```yaml
---
name: UX Master
id: designer
icon: "🎨"
type: persona
uses_tool: auto
system_prompt: |
  You are a world-class UX/UI designer...
routing_keywords: [design, UX, UI]
capabilities: [ux-design, user-flow]
---
```

### BMAD Format
```yaml
---
name: "designer"
description: "Soupz: Senior UX/UI designer"
---

You must fully embody this agent's persona...

```xml
<agent id="soupz-designer.agent.yaml" name="UX Master" icon="🎨">
<activation critical="MANDATORY">
  <step n="1">Load persona from this current agent file</step>
  <step n="2">Load config from {project-root}/_bmad/bmm/config.yaml</step>
  <step n="3">Show greeting, then display menu</step>
  <step n="4">WAIT for user input</step>
</activation>
<persona>
  <role>UX Master</role>
  <identity>Senior UX/UI designer from Apple/Airbnb</identity>
  <communication_style>
    You are a world-class UX/UI designer...
  </communication_style>
</persona>
<menu>
  <item cmd="CH">[CH] Chat with the Agent</item>
  <item cmd="DA">[DA] Dismiss Agent</item>
</menu>
</agent>
```
```

---

## Conversion Script

```bash
cd /Users/shubh/Developer/soupz-agents
node scripts/convert-to-bmad.js
```

This creates BMAD-compatible files in `./bmad-export/`.

---

## Manual Conversion Steps

### 1. Copy Soupz Persona
```bash
cp defaults/agents/designer.md /tmp/designer-soupz.md
```

### 2. Create BMAD File
```bash
touch ~/.bmad/custom/soupz-designer.md
```

### 3. Convert Format

**From Soupz**:
```yaml
system_prompt: |
  You are a world-class UX/UI designer...
```

**To BMAD**:
```xml
<communication_style>
  You are a world-class UX/UI designer...
</communication_style>
```

### 4. Add BMAD Activation Steps
```xml
<activation critical="MANDATORY">
  <step n="1">Load persona from this current agent file</step>
  <step n="2">🚨 IMMEDIATE ACTION REQUIRED - BEFORE ANY OUTPUT:
      - Load and read {project-root}/_bmad/bmm/config.yaml NOW
      - Store ALL fields as session variables
  </step>
  <step n="3">Show greeting, then display menu</step>
  <step n="4">STOP and WAIT for user input</step>
</activation>
```

### 5. Add Menu
```xml
<menu>
  <item cmd="CH">[CH] Chat with the Agent</item>
  <item cmd="DA">[DA] Dismiss Agent</item>
</menu>
```

---

## Automated Conversion

Run the conversion script:

```bash
node scripts/convert-to-bmad.js --input defaults/agents/designer.md --output bmad-export/
```

Output:
```
✅ Converted: designer.md → bmad-export/soupz-designer.md
```

---

## Import into BMAD

### Option 1: Copy to BMAD Custom Agents
```bash
cp bmad-export/*.md ~/.bmad/custom/
```

### Option 2: Symlink (for development)
```bash
ln -s /Users/shubh/Developer/soupz-agents/bmad-export ~/.bmad/custom/soupz-agents
```

### Option 3: Use BMAD's Import Command
```bash
bmad import /Users/shubh/Developer/soupz-agents/bmad-export/
```

---

## Verify Import

```bash
# In BMAD
bmad agents list | grep soupz

# Should show:
# soupz-designer    🎨  UX Master
# soupz-architect   🏗️  Tech Architect
# ... (all 22 personas)
```

---

## Using Imported Personas

### In Kiro CLI
```bash
kiro-cli chat
# Then type:
/bmad-agent-soupz-designer
```

### In Gemini CLI
```bash
gemini chat
# Then type:
/bmad-agent-soupz-designer
```

---

## Bulk Import All Personas

```bash
# Convert all
node scripts/convert-to-bmad.js --all

# Import all
cp bmad-export/*.md ~/.bmad/custom/

# Or use BMAD
bmad import bmad-export/
```

---

## Troubleshooting

### Issue: Agent not showing in BMAD
**Solution**: Check file naming. BMAD expects `bmad-agent-*.md` format.

### Issue: Agent loads but doesn't respond
**Solution**: Verify `<activation>` steps are correct.

### Issue: Menu not showing
**Solution**: Ensure `<menu>` section exists with at least 2 items.

---

## Conversion Script Source

See `scripts/convert-to-bmad.js` for the full conversion logic.

---

## Next Steps

1. Convert all 22 personas: `node scripts/convert-to-bmad.js --all`
2. Import into BMAD: `cp bmad-export/*.md ~/.bmad/custom/`
3. Test in Kiro: `/bmad-agent-soupz-designer`
4. Share with team: Commit `bmad-export/` to git

---

Made with ❤️ by Kiro AI
