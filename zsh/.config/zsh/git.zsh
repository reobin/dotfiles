gc() {
  local repo_url="$1"
  local target_dir="$2"

  if [[ -z "$repo_url" ]]; then
    print 'Usage: gc <repository-url> [directory]'
    return 1
  fi

  if [[ -n "$target_dir" ]]; then
    git clone "$repo_url" "$target_dir" && cd "$target_dir"
  else
    git clone "$repo_url" && cd "$(basename "$repo_url" .git)"
  fi
}

gd() {
  local main current_dir branch reply output

  main="$(git worktree list | awk 'NR==1{print $1}')"
  current_dir="$PWD"

  if [[ "$current_dir" == "$main" ]]; then
    print "Cannot remove the main worktree"
    return 1
  fi

  if command -v gum >/dev/null 2>&1; then
    gum confirm --default=true "Remove worktree and branch?" || {
      print "Cancelled."
      return 0
    }
  else
    printf 'Remove worktree and branch? [Y/n] '
    read -r reply
    case "$reply" in
      ''|[Yy]|[Yy][Ee][Ss]) ;;
      *)
        print "Cancelled."
        return 0
        ;;
    esac
  fi

  branch="$(git branch --show-current)"

  if [[ -z "$branch" ]]; then
    print "No current branch found for this worktree."
    return 1
  fi

  builtin cd "$main" || return 1

  if ! output="$(git wt -D "$branch" 2>&1)"; then
    [[ -n "$output" ]] && printf '%s\n' "$output"
    printf 'Deletion failed. Returning to %s\n' "$current_dir"
    builtin cd "$current_dir" || return 1
    return 1
  fi

  printf 'Deleted worktree and branch "%s"\n' "$branch"
}
