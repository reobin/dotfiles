#!/usr/bin/env bash

set -euo pipefail

PANEL_NAME="eDP-1"
PANEL_CONFIG="2880x1920@120.00000,2560x530,2.00000000,transform,0,vrr,0"

if hyprctl monitors | rg -q "^Monitor ${PANEL_NAME} "; then
  hyprctl keyword monitor "$PANEL_NAME,disable"
else
  hyprctl keyword monitor "$PANEL_NAME,$PANEL_CONFIG"
fi
