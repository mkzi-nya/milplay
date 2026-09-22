#!/usr/bin/env sh
# Rebuild the Safari 12 (iOS 12) compatibility output in compat/.
# --bin-links=false matters on Android shared storage, where npm cannot create symlinks.
set -e
cd "$(dirname "$0")"
[ -d node_modules/@babel/core ] || npm install --bin-links=false
npm run build:compat
