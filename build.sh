#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$ROOT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  printf '%s\n' '错误：未找到 npm，请先安装 Node.js。' >&2
  exit 1
fi

# --no-bin-links also works on Android shared storage, where npm symlinks fail.
npm install --no-bin-links
npm run build:compat

printf '\n构建完成：%s/\n' "$ROOT_DIR/compat"
