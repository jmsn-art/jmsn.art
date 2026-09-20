#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  print 'Install Node.js 22.13 or newer, then open this launcher again.'
  read -r '?Press Enter to close.'
  exit 1
fi
if [[ ! -d node_modules ]]; then
  npm install || exit 1
fi
npm run dev
