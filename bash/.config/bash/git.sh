gd() {
  local main current_dir branch output

  main="$(git worktree list | awk 'NR==1{print $1}')"
  current_dir="$PWD"

  if [[ "$current_dir" == "$main" ]]; then
    printf 'Cannot remove the main worktree\n'
    return 1
  fi

  if ! gum confirm "Remove worktree and branch?"; then
    printf 'Cancelled.\n'
    return 0
  fi

  branch="$(git branch --show-current)"

  if [[ -z "$branch" ]]; then
    printf 'No current branch found for this worktree.\n'
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

for git_completion in \
  /usr/share/bash-completion/completions/git \
  /usr/share/git/completion/git-completion.bash
do
  if [[ -r "$git_completion" ]]; then
    source "$git_completion"
    break
  fi
done

if declare -F __git_complete >/dev/null; then
  __git_complete g __git_main
fi
