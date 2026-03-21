#!/bin/bash
# Setup script for Gemini Team Lead Architecture

echo "Setting up Gemini Team Lead capabilities..."

# 1. Ensure .gemini configuration directory exists
mkdir -p .gemini/skills

# 2. Install tmux if not installed
if ! command -v tmux &> /dev/null; then
    echo "Installing tmux..."
    brew install tmux
else
    echo "tmux is already installed."
fi

# 3. Enable scrolling in tmux
echo "Configuring ~/.tmux.conf for mouse scrolling..."
if ! grep -q "set -g mouse on" ~/.tmux.conf 2>/dev/null; then
    echo "set -g mouse on" >> ~/.tmux.conf
    # Reload if tmux is currently running
    if pgrep -x "tmux" > /dev/null; then
        tmux source-file ~/.tmux.conf
        echo "Reloaded tmux config."
    fi
fi

# 4. Recommend ZSH auto-start
echo ""
echo "================================================="
echo "Optional: Auto-start tmux with ZSH."
echo "If you use Oh My Zsh, add the tmux plugin and these vars:"
echo "plugins=(... tmux ...)"
echo "ZSH_TMUX_AUTOSTART=true"
echo "ZSH_TMUX_AUTOCONNECT=false"
echo "================================================="

# 5. Install RTK proxy for token saving
if ! command -v rtk &> /dev/null; then
    echo "Installing RTK proxy for token optimization..."
    brew install rtk-ai/tap/rtk
else
    echo "RTK proxy is already installed."
fi

echo ""
echo "Setup complete! You can now use the Gemini 'team-lead' skill to spawn parallel tasks in tmux."
echo "Usage: activate_skill 'team-lead' or instruct Gemini to use /team-lead."
