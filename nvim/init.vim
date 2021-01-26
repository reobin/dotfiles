let g:coc_global_extensions = [
\ 'coc-css',
\ 'coc-elixir',
\ 'coc-emmet',
\ 'coc-go',
\ 'coc-html',
\ 'coc-json',
\ 'coc-omnisharp',
\ 'coc-pyright',
\ 'coc-tsserver',
\ ]

call plug#begin()
Plug 'junegunn/fzf', { 'do': { -> fzf#install() } }
Plug 'junegunn/fzf.vim'
Plug 'neoclide/coc.nvim', { 'branch': 'release', 'do': { -> 'coc#util#install()' } }
Plug 'sheerun/vim-polyglot'
Plug 'tpope/vim-commentary'
Plug 'tpope/vim-fugitive'
Plug 'bluz71/vim-moonfly-colors'
call plug#end()

filetype plugin on

let mapleader = ' '

syntax enable
let c_comment_strings=1           " Highlight "strings" within comments
set autoindent                    " Copy indent from current line
set tabstop=2                     " Number of spaces that a <Tab> counts for
set shiftwidth=2                  " The amount of indent added
set expandtab                     " Insert spaces with the <Tab> key
set noswapfile
set relativenumber

if (has('termguicolors'))
  let &t_8f="\<Esc>[38;2;%lu;%lu;%lum"
  let &t_8b="\<Esc>[48;2;%lu;%lu;%lum"
  set termguicolors
endif
set background=dark
colorscheme moonfly

" init.vim
nnoremap <silent> <Leader>ve :e $MYVIMRC<cr>
nnoremap <silent> <Leader>vs :call utils#source_config()<cr>

" fzf
nnoremap <silent> <Leader>p :Files<cr>
nnoremap <silent> <Leader>b :Buffers<cr>

" Explore
let g:netrw_banner = 0
let g:netrw_altfile = 1
let g:netrw_liststyle = 3
nnoremap <silent> <Leader>ee :Explore<cr>

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

" TODO Improve this command
" Last open buffer
nnoremap <silent> <Leader>l <C-^>

" Copy to clipboard
xnoremap <silent> <Leader>c "*y

" Format using appropriate CLI
nnoremap <silent> <Leader>f :call utils#format()<cr>
