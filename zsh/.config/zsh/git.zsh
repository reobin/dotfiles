wtnew() {
  set -e

  local branch="$1"
  local base="${2:-main}"

  local root="$(git rev-parse --show-toplevel)"
  local repo="$(basename "$root")"
  local parent="$(dirname "$root")"
  local wtbase="$parent/${repo}-wt"
  local dir="$wtbase/${branch//\//-}"

  mkdir -p "$wtbase"

  git fetch origin
  git worktree add -b "$branch" "$dir" "origin/$base"

  (cd "$root" && tar --exclude='.git' -cf - .) | (cd "$dir" && tar -xf -)

  cd "$dir"
}

wtremove() {
  set -e

  local branch="$1"
  local root="$(git rev-parse --show-toplevel)"
  local repo="$(basename "$root")"
  local parent="$(dirname "$root")"
  local wtbase="$parent/${repo}-wt"
  local dir="$wtbase/${branch//\//-}"

  git worktree remove "$dir" --force 2>/dev/null || true
  git branch -D "$branch" 2>/dev/null || true
  git worktree prune

  [ -d "$dir" ] && rm -rf "$dir"

  echo "🧹 removed $branch"
}
