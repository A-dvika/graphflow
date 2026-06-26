#!/usr/bin/env bash
set -euo pipefail

npm run lint
npm run build

if [ -n "${VERCEL_TOKEN:-}" ]; then
  npx vercel pull --yes --environment=production --token="$VERCEL_TOKEN"
  npx vercel build --prod --token="$VERCEL_TOKEN"
  npx vercel deploy --prebuilt --prod --token="$VERCEL_TOKEN"
else
  npx vercel deploy --prod
fi
