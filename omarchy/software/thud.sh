#!/bin/sh

if ! command -v thud >/dev/null 2>&1; then
  pnpm add -g thud.sh
fi
