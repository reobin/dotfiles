#!/usr/bin/env bash
set -euo pipefail

# if DP-3 is connected, disable laptop panel, otherwise enable it.
if hyprctl monitors -j | grep -q '"name":"DP-3"'; then
  hyprctl keyword monitor "eDP-1,disable"
  hyprctl keyword monitor "DP-3,preferred,auto,auto"
else
  hyprctl keyword monitor "eDP-1,preferred,auto,auto,cm,srgb"
fi
