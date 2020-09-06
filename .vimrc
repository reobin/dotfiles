if &compatible
  set nocompatible
endif

if &t_Co > 1                     " If terminal supports colors
  syntax enable
  let c_comment_strings=1        " Highlight "strings" within comments
endif

colorscheme SpaceCamp

set ttimeoutlen=50               " Wait up to 50ms after Esc for special key

set backspace=indent,eol,start   " Allow backspace in Insert mode

set ruler                        " Show the cursor position all the time

set showcmd                      " Show incomplete commands while typingt

set relativenumber               " Display relative line number

set autoindent                   " Copy indent from current line
set tabstop=2                    " Number of spaces that a <Tab> counts for
set shiftwidth=2                 " The amount of indent added
set expandtab                    " Insert spaces with the <Tab> key

if 1                             " When vim has compiled with the +eval feature
  filetype plugin indent on      " Enable automatic language-dependant identing
endif
