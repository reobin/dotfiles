call plug#begin('~/.vim/plugged')

Plug 'dikiaap/minimalist'
Plug 'tomtom/tcomment_vim'
Plug 'itchyny/lightline.vim'
Plug 'sheerun/vim-polyglot'
Plug 'prettier/vim-prettier', { 'do': 'npm install' }
Plug 'scrooloose/nerdtree'

call plug#end()

set t_Co=256
syntax on
colorscheme minimalist

""""""""""""""""""""""""""""""""""""""""""""""""""
" Key mappings
""""""""""""""""""""""""""""""""""""""""""""""""""
" leader
map <Space> <Leader>

map <C-n> :NERDTreeToggle<CR>

" C
noremap <silent> <Leader>cc :TComment<CR>

" reloads .vimrc -- making all changes active
map <silent> <Leader>v :source ~/.vimrc<CR>:PlugInstall<CR>:bdelete<CR>:exe ":echo 'vimrc reloaded'"<CR>

""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

" Lightline
let g:lightline = { 'colorscheme': 'minimalist', }
set laststatus=2
set noshowmode

" absolute width of netrw window
let g:netrw_winsize = -28

" tree-view
let g:netrw_liststyle = 3

" sort is affecting only: directories on the top, files below
let g:netrw_sort_sequence = '[\/]$,*'

" open file in a new tab
let g:netrw_browse_split = 3

autocmd vimenter * NERDTree
 
set hidden
set wildmenu
set showcmd
set hlsearch
set ignorecase
set smartcase
set backspace=indent,eol,start
set autoindent
set ruler
set laststatus=2
set confirm
set visualbell
set t_vb=
set mouse=a
set cmdheight=2
set number
set notimeout ttimeout ttimeoutlen=200
set pastetoggle=<F11>
set shiftwidth=2
set softtabstop=2
set expandtab

