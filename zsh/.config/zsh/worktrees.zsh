ga() {
  if [[ -z $1 ]]; then
    print "Usage: ga [branch name]"
    return 1
  fi

  git wt "$1"
}

gd() {
  local main branch cwd reply

  main="$(git worktree list | awk 'NR==1{print $1}')"

  if [[ $PWD == "$main" ]]; then
    print "Cannot remove the main worktree"
    return 1
  fi

  if command -v gum >/dev/null 2>&1; then
    gum confirm "Remove worktree and branch?" || return 0
  else
    printf "Remove worktree and branch? [y/N] "
    read -r reply
    [[ $reply == [Yy] || $reply == [Yy][Ee][Ss] ]] || return 0
  fi

  branch="$(git branch --show-current)"
  cwd="$PWD"

  builtin cd "$main" || return 1
  if ! git wt -D "$branch"; then
    builtin cd "$cwd" || return 1
    return 1
  fi
}
