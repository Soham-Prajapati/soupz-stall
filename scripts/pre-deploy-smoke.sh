#!/bin/bash
set -e

echo "🚀 Starting Pre-Deploy Smoke Test..."

# 1. Verify build
echo "📦 Verifying dashboard build..."
cd packages/dashboard
npm install --silent
npm run build

# 2. Check daemon syntax
echo "🔍 Checking daemon syntax..."
cd ../remote-server
node --check src/index.js

# 3. Run critical tests
echo "🧪 Running critical integration tests..."
cd ../..
npx vitest run tests/pairing.test.js tests/filesystem.test.js

# 4. Check for broken links in docs
echo "🔗 Checking documentation links..."
npm run lint:docs-links || echo "⚠️ Warning: Some documentation links are broken."

echo "✅ Pre-Deploy Smoke Test Passed!"
