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
Plug 'mhinz/vim-signify'
call plug#end()


""""""""""""""""""""""""""
"                        "
"         Leader         "
"                        "
""""""""""""""""""""""""""
let mapleader=' '


""""""""""""""""""""""""""
"                        "
"      Status line       "
"                        "
""""""""""""""""""""""""""
au InsertEnter * hi statusline guifg=black ctermfg=black ctermbg=magenta
au InsertLeave * hi statusline guifg=black ctermfg=black ctermbg=cyan

hi statusline guifg=black ctermfg=black ctermbg=cyan
hi User1 ctermfg=007 ctermbg=239 guibg=#4e4e4e guifg=#adadad

let g:currentmode={
    \ 'n'  : 'Normal',
    \ 'no' : 'Normal·Operator Pending',
    \ 'v'  : 'Visual',
    \ 'V'  : 'V·Line',
    \ '^V' : 'V·Block',
    \ 's'  : 'Select',
    \ 'S'  : 'S·Line',
    \ '^S' : 'S·Block',
    \ 'i'  : 'Insert',
    \ 'R'  : 'Replace',
    \ 'Rv' : 'V·Replace',
    \ 'c'  : 'Command',
    \ 'cv' : 'Vim Ex',
    \ 'ce' : 'Ex',
    \ 'r'  : 'Prompt',
    \ 'rm' : 'More',
    \ 'r?' : 'Confirm',
    \ '!'  : 'Shell',
    \ 't'  : 'Terminal'
    \}

set laststatus=2
set noshowmode
set statusline=
set statusline+=%0*\ %n\                                 " Buffer number
set statusline+=%1*\ %<%f%m%r%h%w\                       " File path, modified, readonly, helpfile, preview
set statusline+=%3*                                      " Separator
set statusline+=%2*\ %Y                                  " FileType
set statusline+=%3*                                      " Separator
set statusline+=%2*\ %{''.(&fenc!=''?&fenc:&enc).''}     " Encoding
set statusline+=\ %{&ff}                                 " FileFormat
set statusline+=%=                                       " Right Side
set statusline+=%2*\ col:\ %02v\                         " Colomn number
set statusline+=%3*                                      " Separator
set statusline+=%1*\ ln:\ %02l/%L\ (%p%%)\               " Line number / total lines, percentage of document
set statusline+=%0*\ %{toupper(g:currentmode[mode()])}\  " The current mode


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
nnoremap <silent> <leader>t :tabnew<cr>
nnoremap <silent> <leader>x :tabclose<cr>
nnoremap <silent> <leader>j gT
nnoremap <silent> <leader>k gt
" Go to last active tab "
au TabLeave * let g:lasttab = tabpagenr()
nnoremap <silent> <leader>l :exe "tabn ".g:lasttab<cr>


""""""""""""""""""""""""""
"                        "
"      Git signify       "
"                        "
""""""""""""""""""""""""""
let g:signify_disable_by_default = 1
nnoremap <silent> <leader>g :SignifyToggle<cr>
highlight SignColumn        ctermbg=NONE                                guibg=NONE    gui=NONE cterm=NONE
highlight SignifySignAdd    ctermfg=green ctermbg=none                  guibg=none
highlight SignifySignDelete ctermfg=red   ctermbg=none    guifg=#ffffff guibg=#ff0000
highlight SignifySignChange ctermfg=blue  ctermbg=none    guifg=#000000 guibg=#ffff00

