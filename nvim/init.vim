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
"          Plugs         "
"                        "
""""""""""""""""""""""""""
call plug#begin()
" fuzzy finder
Plug 'junegunn/fzf'
Plug 'junegunn/fzf.vim'

" Git gutter
Plug 'mhinz/vim-signify'

" Comments
Plug 'tpope/vim-commentary'

" Auto pair
Plug 'jiangmiao/auto-pairs'

" Languages
Plug 'elixir-editors/vim-elixir', { 'for': ['ex', 'exs'] }
Plug 'pangloss/vim-javascript', { 'for': ['js', 'jsx'] }
Plug 'HerringtonDarkholme/yats.vim', { 'for': ['tsx'] }
Plug 'maxmellon/vim-jsx-pretty', { 'for': ['jsx', 'tsx'] }
Plug 'jparise/vim-graphql', { 'for': ['jsx', 'tsx'] }

" css colors
Plug 'lilydjwg/colorizer', { 'for': ['css', 'sass', 'scss', 'styl', 'vim'] }

" Autocomplete
Plug 'neoclide/coc.nvim', {'branch': 'release'}

" Colors
Plug 'NLKNguyen/papercolor-theme'
call plug#end()


""""""""""""""""""""""""""
"                        "
"        General         "
"                        "
""""""""""""""""""""""""""
set ignorecase

let mapleader=' '

" Remove search highlight
nnoremap <silent> <leader>/ :noh<cr>

set number relativenumber
set nu rnu


""""""""""""""""""""""""""
"                        "
"         Colors         "
"                        "
""""""""""""""""""""""""""
set background=light
colorscheme PaperColor


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
au InsertEnter * hi statusline guifg=254 ctermfg=254 ctermbg=magenta
au InsertLeave * hi statusline guifg=254 ctermfg=254 ctermbg=cyan

hi statusline guifg=255 ctermfg=254 ctermbg=cyan
hi User1 ctermfg=black ctermbg=254

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
"        fzf.vim         "
"                        "
""""""""""""""""""""""""""
let g:fzf_preview_window = 'right:50%'

" Customize fzf colors to match your color scheme
let g:fzf_colors =
\ { 'fg':      ['fg', 'Normal'],
  \ 'bg':      ['bg', 'Normal'],
  \ 'hl':      ['fg', 'Comment'],
  \ 'fg+':     ['fg', 'CursorLine', 'CursorColumn', 'Normal'],
  \ 'bg+':     ['bg', 'CursorLine', 'CursorColumn'],
  \ 'hl+':     ['fg', 'Statement'],
  \ 'info':    ['fg', 'PreProc'],
  \ 'gutter':  ['bg', 'Normal'],
  \ 'border':  ['fg', 'Ignore'],
  \ 'prompt':  ['fg', 'Conditional'],
  \ 'pointer': ['fg', 'Exception'],
  \ 'marker':  ['fg', 'Keyword'],
  \ 'spinner': ['fg', 'Label'],
  \ 'header':  ['fg', 'Comment'] }

" Hide status line
autocmd! FileType fzf set laststatus=0 noshowmode noruler
  \| autocmd BufLeave <buffer> set laststatus=2 showmode ruler

nnoremap <silent> <leader>s :Ag<cr>
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
highlight SignColumn ctermbg=none guibg=none gui=none cterm=none
highlight SignifySignAdd ctermfg=green ctermbg=none guibg=none
highlight SignifySignDelete ctermfg=red ctermbg=none
highlight SignifySignChange ctermfg=blue ctermbg=none


""""""""""""""""""""""""""
"                        "
"        external        "
"    format commands     "
"                        "
""""""""""""""""""""""""""
" run black
nnoremap <silent> <leader>fb :!black "%"<cr>
" run black inside Docker
nnoremap <silent> <leader>fdb :!docker exec django black "%"<cr>
" Prettier
nnoremap <silent> <leader>fp :!prettier --write "%"<cr>
" Js beautify through npx
nnoremap <silent> <leader>fjb :!npx js-beautify "%"<cr>
" Elixir
nnoremap <silent> <leader>fe :!mix format "%"<cr>
" Stylus
nnoremap <silent> <leader>fs :!stylus-supremacy format -r "%"<cr>


""""""""""""""""""""""""""
"                        "
"        coc.vim         "
"                        "
""""""""""""""""""""""""""
let g:coc_global_extensions = ['coc-tsserver', 'coc-python', 'coc-css', 'coc-elixir', 'coc-json']
nnoremap <silent> <leader>cr coc#refresh()<cr>
nnoremap <silent> <leader>ci coc#util#install()<cr>
nmap <silent> gd <Plug>(coc-definition)
nmap <silent> gr <Plug>(coc-references)
