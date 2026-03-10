#!/usr/bin/env bash

session_name_from_path() {
  local path="$1"
  if [[ "$path" == "$HOME" ]]; then
    printf '~'
  elif [[ "$path" == "$HOME/"* ]]; then
    printf '%s' "${path#"$HOME/"}"
  else
    printf '%s' "$path"
  fi
}

lowest_window_index() {
  local session_id="$1"
  local lowest=""
  local idx

  while IFS= read -r idx; do
    [[ -z "$idx" ]] && continue
    if [[ -z "$lowest" || "$idx" -lt "$lowest" ]]; then
      lowest="$idx"
    fi
  done < <(tmux list-windows -t "$session_id" -F "#{window_index}" 2>/dev/null)

  printf '%s' "$lowest"
}

unique_session_name() {
  local session_id="$1"
  local base_name="$2"
  local candidate="$base_name"
  local n=2
  local existing_id sid sname

  while true; do
    existing_id=""
    while IFS=' ' read -r sid sname; do
      if [[ "$sname" == "$candidate" ]]; then
        existing_id="$sid"
        break
      fi
    done < <(tmux list-sessions -F "#{session_id} #{session_name}" 2>/dev/null)

    if [[ -z "$existing_id" || "$existing_id" == "$session_id" ]]; then
      printf '%s' "$candidate"
      return
    fi

    candidate="${base_name}-${n}"
    n=$((n + 1))
  done
}

rename_one_session() {
  local session_id="$1"
  local first_idx pane_path desired current_name final_name

  [[ -z "$session_id" ]] && return

  first_idx=$(lowest_window_index "$session_id")
  if [[ -n "$first_idx" ]]; then
    pane_path=$(tmux display-message -p -t "${session_id}:${first_idx}" "#{pane_current_path}" 2>/dev/null)
  fi
  if [[ -z "$pane_path" ]]; then
    pane_path=$(tmux display-message -p -t "$session_id" "#{pane_current_path}" 2>/dev/null)
  fi
  [[ -z "$pane_path" ]] && return

  desired=$(session_name_from_path "$pane_path")
  [[ -z "$desired" || "$desired" == "/" ]] && desired="tmux"

  current_name=$(tmux display-message -p -t "$session_id" "#{session_name}" 2>/dev/null)
  [[ "$desired" == "$current_name" ]] && return

  final_name=$(unique_session_name "$session_id" "$desired")
  tmux rename-session -t "$session_id" -- "$final_name" 2>/dev/null || true
}

if [[ -n "$1" ]]; then
  rename_one_session "$1"
else
  while IFS= read -r sid; do
    [[ -n "$sid" ]] && rename_one_session "$sid"
  done < <(tmux list-sessions -F "#{session_id}" 2>/dev/null)
fi
