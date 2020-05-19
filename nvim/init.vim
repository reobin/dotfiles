""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
"                                                                              "
"                                                                              "
"                  ██╗   ██╗██╗███╗   ███╗██████╗  ██████╗                     "
"                  ██║   ██║██║████╗ ████║██╔══██╗██╔════╝                     "
"                  ██║   ██║██║██╔████╔██║██████╔╝██║                          "
"                  ╚██╗ ██╔╝██║██║╚██╔╝██║██╔══██╗██║                          "
"                   ╚████╔╝ ██║██║ ╚═╝ ██║██║  ██║╚██████╗                     "
"                    ╚═══╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝                     "
"                                                                              "
"                                                                              "
""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
                                       

""""""""""""""""""""""""""
"                        "
"          Plug          "
"                        "
""""""""""""""""""""""""""
call plug#begin()
" Code formatters
Plug 'prettier/vim-prettier', { 'do': 'yarn install' }

" Finders
Plug 'junegunn/fzf', { 'dir': '~/.fzf', 'do': './install --all' }
Plug 'junegunn/fzf.vim'

" Git gutter
Plug 'mhinz/vim-signify'

" Comments
Plug 'tpope/vim-commentary'

" Auto pair
Plug 'jiangmiao/auto-pairs'

" Languages
Plug 'sheerun/vim-polyglot'
Plug 'pangloss/vim-javascript'
Plug 'leafgarland/typescript-vim'
Plug 'ianks/vim-tsx'
Plug 'maxmellon/vim-jsx-pretty'
Plug 'jparise/vim-graphql'

" css colors
Plug 'lilydjwg/colorizer'

" Autocomplete
Plug 'neoclide/coc.nvim', {'branch': 'release'}
call plug#end()


""""""""""""""""""""""""""
"                        "
"        General         "
"                        "
""""""""""""""""""""""""""
set ignorecase


""""""""""""""""""""""""""
"                        "
"         Colors         "
"                        "
""""""""""""""""""""""""""
" set termguicolors
" colorscheme spacecamp_lite
let g:seoul256_background = 236
colo seoul256


""""""""""""""""""""""""""
"                        "
"         Leader         "
"                        "
""""""""""""""""""""""""""
let mapleader=' '


""""""""""""""""""""""""""
"                        "
"     Custom commands    "
"                        "
""""""""""""""""""""""""""
nnoremap <silent> <leader>/ :noh<cr>
"" js
nnoremap <silent> <leader>cl iconsole.log();<esc>hi


""""""""""""""""""""""""""
"                        "
"         netrw          "
"                        "
""""""""""""""""""""""""""
"" Config
let g:netrw_liststyle = 3
let g:netrw_banner = 0

"" Open file explorer
nnoremap <silent> <leader>ee :Explore<cr>
nnoremap <silent> <leader>er :Sexplore<cr>
nnoremap <silent> <leader>ew :Vexplore<cr>

"" Resize pane
" add/remove columns
nnoremap <silent> <leader>ej :resize +5<cr>
nnoremap <silent> <leader>ek :resize -5<cr>
" set pane width to 80 rows
nnoremap <silent> <leader>eo :vertical resize 80<cr>
" add/remove rows
nnoremap <silent> <leader>el :vertical resize +5<cr>
nnoremap <silent> <leader>eh :vertical resize -5<cr>

"" Change pane focus
nnoremap <silent> <leader>w <C-W>w<cr>


""""""""""""""""""""""""""
"                        "
"      Status line       "
"                        "
""""""""""""""""""""""""""
au InsertEnter * hi statusline guifg=black guibg=#f1cf06 ctermfg=black ctermbg=magenta
au InsertLeave * hi statusline guifg=black guibg=#91ABDF ctermfg=black ctermbg=cyan

hi statusline guifg=black guibg=#91ABDF ctermfg=black ctermbg=cyan
hi User1 ctermfg=007 ctermbg=239 guibg=#3D4047 guifg=#adadad

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
set number relativenumber
set nu rnu


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
" nnoremap <silent> <leader>n :Prettier<cr>
nnoremap <silent> <leader>n :! prettier --write %<cr>
let g:prettier#config#print_width = 80
let g:prettier#config#single_quote = 'false'
let g:prettier#config#bracket_spacing = 'true'
let g:prettier#config#jsx_bracket_same_line = 'false'
let g:prettier#config#arrow_parens = 'avoid'
let g:prettier#config#trailing_comma = 'all'
let g:prettier#config#parser = 'babylon'
" Disables quick-fix to auto open when files have errors
let g:prettier#quickfix_enabled=0


""""""""""""""""""""""""""
"                        "
"        fzf.vim         "
"                        "
""""""""""""""""""""""""""
nnoremap <silent> <leader>f :execute 'Ag ' . input('Ag/')<cr><cr>
nnoremap <silent> <leader>p :Files<cr>


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


""""""""""""""""""""""""""
"                        "
"         black          "
"                        "
""""""""""""""""""""""""""
" run black
nnoremap <silent> <leader>b :!black %<cr>
" run black inside Docker
nnoremap <silent> <leader>db :!docker exec django black %<cr>


""""""""""""""""""""""""""
"                        "
"      js-beautify       "
"                        "
""""""""""""""""""""""""""
nnoremap <silent> <leader>dp :!npx js-beautify %<cr>


""""""""""""""""""""""""""
"                        "
"     autocomplete       "
"                        "
""""""""""""""""""""""""""
source ~/.config/nvim/autocomplete.vim


""""""""""""""""""""""""""
"                        "
"        elixir          "
"                        "
""""""""""""""""""""""""""
nnoremap <silent> <leader>ef :!mix format %<cr>


""""""""""""""""""""""""""
"                        "
"        stylus          "
"                        "
""""""""""""""""""""""""""
nnoremap <silent> <leader>sf :!stylus-supremacy format -r %<cr>


""""""""""""""""""""""""""
"                        "
"        coc.vim         "
"                        "
""""""""""""""""""""""""""
let g:coc_global_extensions = ['coc-tsserver', 'coc-python']
" GoTo code navigation.
nmap <silent> gd <Plug>(coc-definition)
nmap <silent> gr <Plug>(coc-references)
