#!/bin/bash

echo "🔧 Tivra DebugMind - Clean Reinstall Script"
echo "==========================================="
echo ""

# Step 1: Remove old extension
echo "1️⃣  Removing old extension..."
rm -rf ~/.vscode/extensions/undefined_publisher.tivra-debugmind-* 2>/dev/null
echo "   ✅ Old extension removed"
echo ""

# Step 2: Clear VS Code cache
echo "2️⃣  Clearing VS Code cache..."
rm -rf ~/Library/Application\ Support/Code/Cache/* 2>/dev/null
rm -rf ~/Library/Application\ Support/Code/CachedData/* 2>/dev/null
echo "   ✅ Cache cleared"
echo ""

# Step 3: Install fresh extension
echo "3️⃣  Installing fresh extension..."
/Applications/Visual\ Studio\ Code.app/Contents/Resources/app/bin/code --install-extension ./tivra-debugmind-0.2.1-beta.vsix --force

if [ $? -eq 0 ]; then
    echo "   ✅ Extension installed successfully"
else
    echo "   ❌ Installation failed. Try manually with:"
    echo "      /Applications/Visual\\ Studio\\ Code.app/Contents/Resources/app/bin/code --install-extension ./tivra-debugmind-0.2.1-beta.vsix --force"
fi

echo ""
echo "🎉 Done! Now:"
echo "   1. Close all VS Code windows (Cmd+Q)"
echo "   2. Reopen VS Code"
echo "   3. Open Debug Console (View → Debug Console)"
echo "   4. Open Tivra DebugMind"
echo "   5. You should see: [Tivra DebugMind] API URL: http://localhost:3001"
echo ""
