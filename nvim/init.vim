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

" Comments
Plug 'tpope/vim-commentary'

" Auto pair
Plug 'jiangmiao/auto-pairs'

" Syntax highlighting
Plug 'elixir-editors/vim-elixir', { 'for': ['ex', 'exs'] }
Plug 'pangloss/vim-javascript', { 'for': ['js', 'jsx'] }
Plug 'HerringtonDarkholme/yats.vim', { 'for': ['tsx'] }
Plug 'maxmellon/vim-jsx-pretty', { 'for': ['jsx', 'tsx'] }
Plug 'jparise/vim-graphql', { 'for': ['jsx', 'tsx'] }
Plug 'mtdl9/vim-log-highlighting', { 'for': ['log'] }

" Autocomplete
Plug 'neoclide/coc.nvim', {'branch': 'release'}

" Colors
Plug 'morhetz/gruvbox'

" Status line
Plug 'vim-airline/vim-airline'
call plug#end()


""""""""""""""""""""""""""
"                        "
"        General         "
"                        "
""""""""""""""""""""""""""
set ignorecase
set number relativenumber
let mapleader=' '

" Remove search highlight
nnoremap <silent> <leader>/ :noh<cr>


""""""""""""""""""""""""""
"                        "
"      Status line       "
"                        "
""""""""""""""""""""""""""
set background=dark
let g:airline_theme='gruvbox'
let g:airline_left_sep=''
let g:airline_left_alt_sep=''
let g:airline_right_sep=''
let g:airline_right_alt_sep=''
let g:airline_skip_empty_sections=1
let g:airline_section_z='%02l/%L %02v'
set noshowmode  " to get rid of thing like --INSERT--
set noshowcmd  " to get rid of display of last command
set shortmess+=F  " to get rid of the file name displayed in the command line bar


""""""""""""""""""""""""""
"                        "
"         Colors         "
"                        "
""""""""""""""""""""""""""
let g:gruvbox_italic=1
let g:gruvbox_invert_selection=0
set termguicolors
set cursorline
colorscheme gruvbox

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
let g:fzf_layout = { 'window': { 'width': 0.9, 'height': 0.9 } }
let g:fzf_preview_window = 'right:40%'

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
"       vim tabs         "
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
"        external        "
"    format commands     "
"                        "
""""""""""""""""""""""""""
" run black
nnoremap <silent> <leader>fb :!black "%"<cr>
" run black inside Docker
nnoremap <silent> <leader>fdb :!docker exec django black "%"<cr>
" Prettier
nnoremap <silent> <leader>fp :!prettier --write --plugin-search-dir=. "%"<cr>
" Js beautify through npx
nnoremap <silent> <leader>fjb :!npx js-beautify -r "%"<cr>
" Elixir
nnoremap <silent> <leader>fe :!mix format "%"<cr>
" Stylus
nnoremap <silent> <leader>fs :!stylus-supremacy format -r "%"<cr>
" Go
nnoremap <silent> <leader>fg :!go fmt "%"<cr>


""""""""""""""""""""""""""
"                        "
"        coc.vim         "
"                        "
""""""""""""""""""""""""""
let g:coc_global_extensions = ['coc-tsserver', 'coc-python', 'coc-css', 'coc-elixir', 'coc-json', 'coc-go']
nnoremap <silent> <leader>cr coc#refresh()<cr>
nnoremap <silent> <leader>ci coc#util#install()<cr>
nmap <silent> gd <Plug>(coc-definition)
nmap <silent> gr <Plug>(coc-references)
