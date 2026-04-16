#!/usr/bin/env bash
jq -j '
  def fmt:
    if . >= 1000000 then "\(. / 1000000 * 10 | round / 10)m"
    elif . >= 1000 then "\(. / 1000 * 10 | round / 10)k"
    else "\(.)"
    end;
  (.context_window.current_usage // {}) as $u |
  (($u.input_tokens // 0)
    + ($u.cache_creation_input_tokens // 0)
    + ($u.cache_read_input_tokens // 0)) as $tokens |
  (.context_window.used_percentage // 0) as $pct |
  if $tokens == 0 then ""
  else "\u001b[33m\($tokens | fmt)\u001b[0m \u001b[2m(\($pct * 10 | round / 10)%)\u001b[0m"
  end
'
