call plug#begin()
Plug 'junegunn/fzf', { 'do': { -> fzf#install() } }
Plug 'junegunn/fzf.vim'

Plug 'sainnhe/edge'
call plug#end()

syntax enable
let c_comment_strings=1           " Highlight "strings" within comments

if (empty($TMUX) && has("termguicolors"))
  set termguicolors
endif
set termguicolors
set background=dark
let g:edge_enable_italic = 0
let g:edge_disable_italic_comment = 1
colorscheme edge

set relativenumber                " Display relative line number

set autoindent                    " Copy indent from current line
set tabstop=2                     " Number of spaces that a <Tab> counts for
set shiftwidth=2                  " The amount of indent added
set expandtab                     " Insert spaces with the <Tab> key

let mapleader = " "

" fzf
nnoremap <Leader>p :Files<cr>
