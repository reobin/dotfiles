#!/usr/bin/env bash

if command -v thud.sh >/dev/null 2>&1; then
  echo "thud.sh is already installed"
  return 0
fi

pnpm add -g thud.sh
