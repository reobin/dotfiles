trash() {
  mkdir -p ~/.local/share/Trash/files
  mv -- "$@" ~/.local/share/Trash/files/
  echo "Moved to ~/.local/share/Trash/files/"
}

if declare -F _filedir >/dev/null 2>&1; then
  complete -o bashdefault -o default -F _filedir trash
else
  complete -o bashdefault -o default -A file trash
fi
