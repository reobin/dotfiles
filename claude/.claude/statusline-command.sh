#!/usr/bin/env bash
input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id // "default"')
total=$(echo "$input" | jq '((.context_window.total_input_tokens // 0) + (.context_window.total_output_tokens // 0))')
echo "$total" > "/tmp/claude-statusline-total-$session_id"
offset=$(cat "/tmp/claude-statusline-offset-$session_id" 2>/dev/null || echo 0)
adjusted=$((total - offset))
echo "$input" | jq -j --argjson total "$adjusted" '
  def fmt:
    if . >= 1000000 then "\(. / 1000000 * 10 | round / 10)m"
    elif . >= 1000 then "\(. / 1000 * 10 | round / 10)k"
    else "\(.)"
    end;
  (.context_window.used_percentage // null) as $pct |
  if $total == 0 then ""
  elif $pct then "\u001b[33m\($total | fmt)\u001b[0m \u001b[2m(\($pct * 10 | round / 10)%)\u001b[0m"
  else "\u001b[33m\($total | fmt)\u001b[0m"
  end
'
