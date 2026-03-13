#!/usr/bin/env bash

set -euo pipefail

PANEL_NAME="eDP-1"
PANEL_CONFIG="preferred,auto,1.60000000"

active_monitor_count() {
  hyprctl monitors | awk '$1 == "Monitor" { count++ } END { print count + 0 }'
}

panel_dpms_on() {
  hyprctl monitors all | awk -v panel="$PANEL_NAME" '
    $1 == "Monitor" && $2 == panel { in_panel = 1; next }
    $1 == "Monitor" { in_panel = 0 }
    in_panel && $1 == "dpmsStatus:" { print $2; exit }
  ' | rg -q '^1$'
}

dpms_off_delayed() {
  # Delay avoids immediate wake from the same keypress event.
  nohup bash -lc 'sleep 0.35; hyprctl dispatch dpms off' >/dev/null 2>&1 &
}

if hyprctl monitors | rg -q "^Monitor ${PANEL_NAME} "; then
  if [[ "$(active_monitor_count)" -le 1 ]]; then
    if panel_dpms_on; then
      dpms_off_delayed
    else
      hyprctl dispatch dpms on
    fi
  else
    hyprctl keyword monitor "$PANEL_NAME,disable"
  fi
else
  hyprctl keyword monitor "$PANEL_NAME,$PANEL_CONFIG"
  hyprctl dispatch dpms on
fi
