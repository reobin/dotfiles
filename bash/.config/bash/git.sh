gc() {
  local repo="$1"
  local target_dir="$2"

  if [[ -z "$repo" ]]; then
    printf 'Usage: gc <owner/repo> [directory]\n'
    return 1
  fi

  if ! command -v gh >/dev/null 2>&1; then
    printf 'gh CLI is not installed\n'
    return 1
  fi

  local dir_name
  if [[ -n "$target_dir" ]]; then
    dir_name="$target_dir"
  else
    dir_name="$(basename "$repo" .git)"
  fi

  if [[ -d "$dir_name" ]]; then
    printf 'Using existing clone: %s\n' "$dir_name"
    cd "$dir_name"
    return 0
  fi

  local clone_args=("$repo")
  [[ -n "$target_dir" ]] && clone_args+=("$target_dir")

  printf 'Cloning %s with SSH...\n' "$repo"
  if gh repo clone "${clone_args[@]}" -- --progress; then
    printf 'Clone complete. Entering %s\n' "$dir_name"
    cd "$dir_name"
  else
    printf 'SSH clone failed. Trying HTTPS...\n'
    if [[ "$repo" != *"://"* && "$repo" != *"@"* ]]; then
      local https_repo="https://github.com/$repo.git"
      local https_clone_args=("$https_repo")
      [[ -n "$target_dir" ]] && https_clone_args+=("$target_dir")

      printf 'Cloning %s with HTTPS...\n' "$repo"
      if gh repo clone "${https_clone_args[@]}" -- --progress; then
        printf 'Clone complete. Entering %s\n' "$dir_name"
        cd "$dir_name"
        return 0
      fi
    fi
    printf 'Clone failed.\n'
    return 1
  fi
}

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
