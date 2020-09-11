call plug#begin()
Plug 'junegunn/fzf', { 'do': { -> fzf#install() } }
Plug 'junegunn/fzf.vim'

Plug 'neoclide/coc.nvim', { 'branch': 'release' }

Plug 'cocopon/iceberg.vim'

Plug 'sheerun/vim-polyglot'

Plug 'cocopon/vaffle.vim'

Plug 'tpope/vim-commentary'

Plug 'tpope/vim-fugitive'
call plug#end()

filetype plugin on

syntax enable
let c_comment_strings=1           " Highlight "strings" within comments
set relativenumber                " Display relative line number
set autoindent                    " Copy indent from current line
set tabstop=2                     " Number of spaces that a <Tab> counts for
set shiftwidth=2                  " The amount of indent added
set expandtab                     " Insert spaces with the <Tab> key

if (has('termguicolors'))
  set termguicolors
endif
set background=dark
colorscheme iceberg

let mapleader = ' '

if (!exists('*SourceConfig'))
  function SourceConfig() abort
    source ~/.config/nvim/autoload/*
    source $MYVIMRC
  endfunction
endif

" init.vim related
nnoremap <silent> <Leader>ve :e $MYVIMRC<cr>
nnoremap <silent> <Leader>vs :call SourceConfig()<cr>

" fzf
nnoremap <silent> <Leader>p :Files<cr>
nnoremap <silent> <Leader>b :Buffers<cr>

" coc.nvim
nnoremap <Leader>s :Ag<cr>

" Turn off search highlighting (gets turned back on when searching)
nnoremap <Leader>/ :noh<cr>

" Function is load from the ~/.config/nvim/autoload directory
call statusline#_init()
