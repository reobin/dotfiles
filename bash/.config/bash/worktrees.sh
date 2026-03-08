ga() {
  if [[ -z "$1" ]]; then
    echo "Usage: ga [branch name]"
    return 1
  fi

  git wt "$1"
}

gd() {
  local main branch cwd

  main="$(git worktree list | awk 'NR==1{print $1}')"

  if [[ "$(pwd)" == "$main" ]]; then
    echo "Cannot remove the main worktree"
    return 1
  fi

  if gum confirm "Remove worktree and branch?"; then
    branch="$(git branch --show-current)"
    cwd="$(pwd)"
    cd "$main"
    if ! git wt -D "$branch"; then
      cd "$cwd"
      return 1
    fi
  fi
}
