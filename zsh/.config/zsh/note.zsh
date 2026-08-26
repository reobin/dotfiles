# The global note, separate from nvim's <leader>n scratch. Both are plain files
# under ~/Documents/notes so they stay readable outside a terminal.
NOTE_FILE="$HOME/Documents/notes/note.md"

note() {
  emulate -L zsh

  # A fresh machine has no notes directory, and the write below is silenced, so
  # without this every keystroke fails quietly and the whole note is lost on close.
  command mkdir -p "${NOTE_FILE:h}" || return 1

  # Closing the surface kills nvim outright, so every keystroke has to already be
  # on disk. snacks scratch only writes on BufHidden, which a kill never reaches.
  # TextChangedP is the third event because blink's popup suppresses TextChangedI
  # for every keystroke typed while the menu is up.
  #
  # -n because that same kill leaves a swap file behind, and the next `tab n` would
  # open on the recovery prompt rather than in the file. There is nothing to
  # recover: the buffer is already written.
  nvim -n \
    -c 'autocmd TextChanged,TextChangedI,TextChangedP <buffer> silent! write' \
    -c 'normal! G' \
    "$NOTE_FILE"
}
