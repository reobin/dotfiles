#!/usr/bin/env bash
set -euo pipefail

INTERNAL="eDP-1"
LOG_FILE="/tmp/monitors-debug.log"

log() {
  echo "$*" | tee -a "${LOG_FILE}"
}

LID_STATE=""
if [ -r /proc/acpi/button/lid ]; then
  LID_STATE="$(awk '{print $NF; exit}' /proc/acpi/button/lid/*/state 2>/dev/null || true)"
fi

EXTERNALS="$(hyprctl monitors | awk -v internal="${INTERNAL}" '/^Monitor /{if ($2!=internal)print $2}')"
EXTERNAL="$(printf '%s\n' "${EXTERNALS}" | awk 'NF{print; exit}')"

log "external detected: ${EXTERNALS:-none}"
log "lid state: ${LID_STATE:-unknown}"

if [ -n "${EXTERNAL}" ]; then
  hyprctl keyword monitor "${EXTERNAL},preferred,auto,auto"
  if [ "${LID_STATE}" = "closed" ]; then
    hyprctl keyword monitor "${INTERNAL},disable"
  else
    hyprctl keyword monitor "${INTERNAL},preferred,auto,auto,mirror,${EXTERNAL}"
  fi
else
  hyprctl keyword monitor "${INTERNAL},preferred,auto,auto,cm,srgb"
fi
