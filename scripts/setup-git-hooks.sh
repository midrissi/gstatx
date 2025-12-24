#!/bin/sh
# Setup script to configure git to use versioned hooks from .githooks directory

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/.githooks"

# Check if .githooks directory exists
if [ ! -d "$HOOKS_DIR" ]; then
  echo "Error: .githooks directory not found at $HOOKS_DIR"
  exit 1
fi

# Configure git to use .githooks directory for hooks
git config core.hooksPath "$HOOKS_DIR"

# Make sure all hooks are executable
chmod +x "$HOOKS_DIR"/*

echo "✓ Git hooks configured to use .githooks directory"
echo "✓ All hooks are executable"

