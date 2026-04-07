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
