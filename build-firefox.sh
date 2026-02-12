#!/bin/bash
set -e

echo "Building mv-premium for Firefox..."
npm run build:firefox

echo "Zipping extension..."
rm -f .output/mv-premium.zip
cd .output/firefox-mv2
zip -r ../mv-premium.zip .
cd ../..

echo ""
echo "Done! Install from: .output/mv-premium.zip"
