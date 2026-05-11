#!/bin/bash
dir="${1:-$HOME}"

max=0
while read -r name; do
  [[ "$name" =~ ^[a-z]+$ ]] || continue
  n=0
  for ((i=0; i<${#name}; i++)); do
    c="${name:$i:1}"
    printf -v code '%d' "'$c"
    n=$(( n * 26 + code - 96 ))
  done
  (( n > max )) && max=$n
done < <(tmux list-sessions -F '#{session_name}' 2>/dev/null)

n=$(( max + 1 ))
result=""
chars=({a..z})
while (( n > 0 )); do
  ((n--))
  result="${chars[$((n % 26))]}$result"
  (( n /= 26 ))
done

tmux new-session -d -s "$result" -c "$dir" && tmux switch-client -t "$result"
