#!/usr/bin/env bash
set -euo pipefail

missing=0

check_command() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "missing: $name"
    missing=1
  else
    echo "ok: $name ($("$name" --version 2>&1 | head -n 1))"
  fi
}

check_command node
check_command npm
check_command aws

if ! command -v vercel >/dev/null 2>&1; then
  echo "missing: vercel"
  echo "hint: npm i -g vercel"
  missing=1
else
  echo "ok: vercel ($(vercel --version 2>&1 | head -n 1))"
fi

if [ "$missing" -ne 0 ]; then
  echo
  echo "Install the missing tools, then rerun this script."
  exit 1
fi

aws sts get-caller-identity --output table
