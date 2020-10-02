call plug#begin()
Plug 'junegunn/fzf', { 'do': { -> fzf#install() } }
Plug 'junegunn/fzf.vim'

Plug 'neoclide/coc.nvim', { 'branch': 'release' }

Plug 'embark-theme/vim', { 'as': 'embark' }

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
set tw=80

if (has('termguicolors'))
  let &t_8f="\<Esc>[38;2;%lu;%lu;%lum"
  let &t_8b="\<Esc>[48;2;%lu;%lu;%lum"
  set termguicolors
endif
set background=dark
colorscheme embark

let mapleader = ' '

if (!exists('*SourceConfig'))
  function SourceConfig() abort
    source ~/.config/nvim/autoload/*
    source $MYVIMRC
  endfunction
endif

" init.vim
nnoremap <silent> <Leader>ve :e $MYVIMRC<cr>
nnoremap <silent> <Leader>vs :call SourceConfig()<cr>

" fzf
nnoremap <silent> <Leader>p :Files<cr>
nnoremap <silent> <Leader>b :Buffers<cr>

" Vaffle
let g:vaffle_show_hidden_files = 1
nnoremap <silent> <Leader>ee :Vaffle<cr>
nnoremap <silent> <Leader>ec :Vaffle %<cr>
function! OpenVaffleInSplit(vertical)
  if a:vertical
    :vsplit
  else
    :split
  endif
  :Vaffle %
endfunction
nnoremap <silent> <Leader>es :call OpenVaffleInSplit(0)<cr>
nnoremap <silent> <Leader>evs :call OpenVaffleInSplit(1)<cr>

" coc.nvim
nnoremap <silent> <Leader>s :Rg<cr>
nnoremap <silent> gd :call CocAction('jumpDefinition', 'drop')<cr>

" Turn off search highlighting (gets turned back on when searching)
nnoremap <silent> <Leader>/ :noh<cr>

" fugitive
nnoremap <silent> <Leader>gs :G<cr>
nnoremap <silent> <Leader>gl :diffget //3<cr>
nnoremap <silent> <Leader>gh :diffget //2<cr>

" splits
nnoremap <silent> <Leader>ek :res +5<cr>
nnoremap <silent> <Leader>ej :res -5<cr>
nnoremap <silent> <Leader>el :vertical resize +5<cr>
nnoremap <silent> <Leader>eh :vertical resize -5<cr>

" Last open buffer
nnoremap <silent> <Leader>l <C-^>

" Functions are loaded from the ~/.config/nvim/autoload directory
au VimEnter * call statusline#_init()
au VimEnter * call format#_init()
