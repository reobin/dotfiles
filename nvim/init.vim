""""""""""""""""""""""""""
"                        "
"          Plug          "
"                        "
""""""""""""""""""""""""""
call plug#begin()
Plug 'prettier/vim-prettier', { 'do': 'yarn install' }
Plug 'scrooloose/nerdtree'
Plug 'Xuyuanp/nerdtree-git-plugin'
Plug 'junegunn/fzf', { 'dir': '~/.fzf', 'do': './install --all' }
Plug 'junegunn/fzf.vim'
call plug#end()


""""""""""""""""""""""""""
"                        "
"         Leader         "
"    Custom commands     "
"                        "
""""""""""""""""""""""""""
let mapleader=' '


""""""""""""""""""""""""""
"                        "
"    Relative Numbers    "
"                        "
""""""""""""""""""""""""""
set relativenumber


""""""""""""""""""""""""""
"                        "
"     Tab characters     "
"                        "
""""""""""""""""""""""""""
filetype plugin indent on
" On pressing tab, insert 2 spaces
set expandtab
" show existing tab with 2 spaces width
set tabstop=2
set softtabstop=2
" when indenting with '>', use 2 spaces width
set shiftwidth=2


""""""""""""""""""""""""""
"                        "
"        Prettier        "
"                        "
""""""""""""""""""""""""""
let g:prettier#config#print_width = 120
let g:prettier#config#single_quote = 'false'
let g:prettier#config#bracket_spacing = 'true'
let g:prettier#config#jsx_bracket_same_line = 'false'
let g:prettier#config#arrow_parens = 'avoid'
let g:prettier#config#trailing_comma = 'all'
let g:prettier#config#parser = 'babylon'

""""""""""""""""""""""""""
"                        "
"        NERDTree        "
"                        "
""""""""""""""""""""""""""
nnoremap <silent> <leader>e :NERDTreeToggle<cr>
nnoremap <silent> <leader>w <c-w>w
" Open NERDTree automatically when vim starts up on opening a directory "
autocmd StdinReadPre * let s:std_in=1
autocmd VimEnter * if argc() == 1 && isdirectory(argv()[0]) && !exists("s:std_in") | exe 'NERDTree' argv()[0] | wincmd p | ene | exe 'cd '.argv()[0] | endif


""""""""""""""""""""""""""
"                        "
"        fzf.vim         "
"                        "
""""""""""""""""""""""""""
nnoremap <silent> <leader>f :execute 'Ag ' . input('Ag/')<cr><cr>
nnoremap <silent> <leader>p :Files<cr><cr>


""""""""""""""""""""""""""
"                        "
"         Tabs           "
"                        "
""""""""""""""""""""""""""
nnoremap <silent> <leader>t :tabnew<CR>
nnoremap <silent> <leader>x :tabclose<CR>
nnoremap <silent> <leader>j gT
nnoremap <silent> <leader>k gt
" Go to last active tab "
au TabLeave * let g:lasttab = tabpagenr()
nnoremap <silent> <leader>l :exe "tabn ".g:lasttab<cr>

