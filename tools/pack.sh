#!/usr/bin/env bash
# Packs the game into bunkier-115.tar.gz (node_modules are installed on the server with npm ci).
set -euo pipefail
cd "$(dirname "$0")/.."
tar -czf bunkier-115.tar.gz package.json package-lock.json server shared client deploy
echo "Package: $(pwd)/bunkier-115.tar.gz ($(du -h bunkier-115.tar.gz | cut -f1))"
