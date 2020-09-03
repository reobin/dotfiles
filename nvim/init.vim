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
Plug 'junegunn/fzf', { 'do': { -> fzf#install() } }
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
Plug 'dikiaap/minimalist'
Plug 'NLKNguyen/papercolor-theme'

" Status line
Plug 'vim-airline/vim-airline'
call plug#end()


""""""""""""""""""""""""""
"                        "
"        General         "
"                        "
""""""""""""""""""""""""""
set noswapfile
set ignorecase
set number relativenumber
set cursorline
set termguicolors

let mapleader=' '

" Remove search highlight
nnoremap <silent> <leader>/ :noh<cr>


""""""""""""""""""""""""""
"                        "
"         Colors         "
"                        "
""""""""""""""""""""""""""
syntax enable
set t_Co=256
set background=dark
colorscheme PaperColor


""""""""""""""""""""""""""
"                        "
"      Status line       "
"                        "
""""""""""""""""""""""""""
let g:airline_left_sep=''
let g:airline_left_alt_sep=''
let g:airline_right_sep=''
let g:airline_right_alt_sep=''
let g:airline_skip_empty_sections=1
let g:airline_section_z='%02l/%L %02v'
let g:airline#extensions#branch#enabled = 0
let g:airline_solarized_bg='dark'
let g:airline_theme='minimalist'

set noshowmode  " to get rid of thing like --INSERT--
set noshowcmd  " to get rid of display of last command
set shortmess+=F  " to get rid of the file name displayed in the command line bar


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
nnoremap <silent> <leader>s :Rg<cr>
nnoremap <silent> <leader>p :Files<cr>
nnoremap <silent> ; :Buffers<cr>


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
