export const DOCS_DATA = [
  {
    section: "Get Started",
    items: [
      {
        id: "overview",
        title: "Overview",
        content: `# What is Soupz?

Soupz is a hosted web IDE that bridges your laptop to the browser. Think of it as your intelligent, accessible-anywhere coding assistant. Whether you are on your phone, tablet, or another PC, Soupz connects directly to your local workspace.

## Key Benefits
- **Work anywhere**: Code from your phone while moving, or seamlessly share sessions across devices.
- **Local execution**: Commands run on your machine, where your code and tools live.
- **AI-powered**: Built-in CLI agents like Copilot, Claude Code, and Gemini to accelerate your development.
        `
      },
      {
        id: "quickstart",
        title: "Quickstart",
        content: `# Quickstart

Get up and running with Soupz in less than a minute.

1. Ensure you have Node.js installed on your machine.
2. Open your terminal in the directory you want to work on.
3. Run the following command:

\`\`\`bash
npx soupz
\`\`\`

4. You'll receive a 9-character code or a QR code.
5. Go to soupz.vercel.app and enter the code to pair your device. You're ready to code!`
      },
      {
        id: "installation",
        title: "Installation",
        content: `# Installation

Soupz does not require a permanent global installation, though you can save it if you prefer.

The easiest way is using \`npx\`:

\`\`\`bash
npx soupz
\`\`\`

If you want to install it globally:
\`\`\`bash
npm install -g soupz-cockpit
\`\`\`
`
      }
    ]
  },
  {
    section: "Usage",
    items: [
      {
        id: "chat-vs-ide",
        title: "Chat & IDE Modes",
        content: `# Chat & IDE Modes

Soupz provides two core viewing experiences depending on your device and needs.

## Chat Mode
A lightweight, mobile-first interface optimized for quick questions, reading code, and issuing voice commands. Perfect for reviewing changes on your phone.

## IDE Mode
A full-featured pro environment including:
- Monaco Editor (VS Code in the browser)
- Real-time Git staging and diffing
- Integrated Terminal
- Interactive file tree`
      },
      {
        id: "voice-input",
        title: "Voice Commands",
        content: `# Voice Commands

Soupz supports high-quality Speech-to-Text utilizing Sarvam AI (with browser fallbacks). 

Simply tap the microphone icon in Chat mode to start speaking. Soupz will transcribe it and route your request to the most capable AI agent in your fallback chain.`
      }
    ]
  }
];
