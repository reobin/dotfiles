call plug#begin()
Plug 'prettier/vim-prettier', { 'do': 'yarn install' }
call plug#end()

" Relative numbers "
set relativenumber
colorscheme horizon

" Color scheme "
set termguicolors

" Leader "
let mapleader=" "

" Tabs "
filetype plugin indent on
" On pressing tab, insert 2 spaces
set expandtab
" show existing tab with 2 spaces width
set tabstop=2
set softtabstop=2
" when indenting with '>', use 2 spaces width
set shiftwidth=2

" Prettier "
let g:prettier#config#print_width = 120
let g:prettier#config#single_quote = 'false'
let g:prettier#config#bracket_spacing = 'true'
let g:prettier#config#jsx_bracket_same_line = 'false'
let g:prettier#config#arrow_parens = 'avoid'
let g:prettier#config#trailing_comma = 'all'
let g:prettier#config#parser = 'babylon'

