if &compatible
  set nocompatible
endif

if &t_Co > 1                     " If terminal supports colors
  syntax enable
  let c_comment_strings=1        " Highlight "strings" within comments
endif

set autoindent                   " Copy indent from current line
set tabstop=2                    " Number of spaces that a <Tab> counts for
set shiftwidth=2                 " The amount of indent added
set expandtab                    " Insert spaces with the <Tab> key

set ttimeoutlen=50               " wait up to 50ms after Esc for special key

set backspace=indent,eol,start   " Allow backspace in Insert mode

set ruler                        " show the cursor position all the time
