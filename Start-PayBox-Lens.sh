#!/bin/sh
set -eu
LENS_APP_ROOT=$(CDPATH= cd "$(dirname "$0")" && pwd)
cd "$LENS_APP_ROOT"
if [ ! -x "$LENS_APP_ROOT/runtime/node" ]; then
  printf '%s\n' 'Extract the matching portable ZIP from GitHub Releases. See docs/EASY_START.md.'
  exit 1
fi
exec "$LENS_APP_ROOT/runtime/node" "$LENS_APP_ROOT/scripts/portable-start.mjs"
