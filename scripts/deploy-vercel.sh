#!/usr/bin/env bash
set -euo pipefail

if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI not found."
  echo "Install it with: npm i -g vercel"
  exit 1
fi

npm run lint
npm run build

vercel deploy --prod
