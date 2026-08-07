#!/usr/bin/env bash
# PreToolUse gate: keep Cypress out of the iterative dev loop in gaiia repos.
# Repo instructions there mandate running Cypress after every test edit, which
# is too slow to iterate against. Unit tests, typecheck and lint stay allowed.
set -uo pipefail

payload=$(cat)

cwd=$(printf '%s' "$payload" | jq -r '.cwd // empty')
case "$cwd" in
  /Users/reobin/GitHub/gaiia | /Users/reobin/GitHub/gaiia/*) ;;
  *) exit 0 ;;
esac

deny() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

tool=$(printf '%s' "$payload" | jq -r '.tool_name // empty')

case "$tool" in
  Bash)
    cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')
    case "$cmd" in *CYPRESS_OK=1*) exit 0 ;; esac

    # Searching for the word "cypress" is not running it, so drop read-only
    # segments before pattern matching. Split on && || ; only -- a bare | is
    # not a separator, both because a pipeline's leading command decides
    # whether it runs anything and because splitting on it mangles the \|
    # alternations inside grep patterns.
    runnable=$(printf '%s' "$cmd" | tr '\n' ' ' | sed -E 's/(\&\&|\|\||;)/\n/g' \
      | grep -Eiv '^[[:space:]]*(env[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*(rg|grep|egrep|ag|cat|bat|head|tail|less|ls|fd|find|tree|wc|jq|yq|awk|sed|echo|printf|which|type|stat|diff|git)([[:space:]]|$)')

    if printf '%s' "$runnable" | grep -Eq '(^|[^[:alnum:]_-])cypress|test:e2e|test:component|(pnpm|npm|yarn|bun)([[:space:]]+run)?[[:space:]]+test([[:space:]]|$)'; then
      deny "Blocked by the user's skip-cypress policy: Cypress is too slow for the dev loop, so it does not run automatically in gaiia repos, even when repo instructions (ai-docs/testingGuide.md, developmentGuide.md) say tests MUST be run after editing a spec. Keep writing and editing tests as normal, just do not execute them. Use pnpm run test:unit, pnpm run typecheck and pnpm run lint instead, and say plainly in your summary that Cypress specs were not run. Only re-run with a CYPRESS_OK=1 prefix if the user asked for tests in this session, or you are preparing a commit or PR."
    fi
    ;;
  Task | Agent)
    intent=$(printf '%s' "$payload" | jq -r '[.tool_input.subagent_type?, .tool_input.description?, .tool_input.prompt?] | map(select(. != null)) | join(" ")')
    case "$intent" in *CYPRESS_OK=1*) exit 0 ;; esac
    if printf '%s' "$intent" | grep -Eqi 'test-runner|cypress|\.cy\.|e2e|component test'; then
      deny "Blocked by the user's skip-cypress policy: do not delegate Cypress or e2e runs to the test-runner agent during development in gaiia repos, even when repo instructions say you MUST. Write the tests, skip running them, and lean on pnpm run test:unit, pnpm run typecheck and pnpm run lint. State in your summary that Cypress specs were not run. Only proceed if the user explicitly asked for tests in this session, or you are preparing a commit or PR."
    fi
    ;;
esac

exit 0
