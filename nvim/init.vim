call plug#begin()
Plug 'junegunn/fzf', { 'do': { -> fzf#install() } }
Plug 'junegunn/fzf.vim'
Plug 'neoclide/coc.nvim', { 'branch': 'release' }
Plug 'cormacrelf/vim-colors-github'
Plug 'sheerun/vim-polyglot'
Plug 'tpope/vim-commentary'
Plug 'tpope/vim-fugitive'
call plug#end()

filetype plugin on

syntax enable
let c_comment_strings=1           " Highlight "strings" within comments
set autoindent                    " Copy indent from current line
set tabstop=2                     " Number of spaces that a <Tab> counts for
set shiftwidth=2                  " The amount of indent added
set expandtab                     " Insert spaces with the <Tab> key
set noswapfile
set tw=80
set number

if (has('termguicolors'))
  let &t_8f="\<Esc>[38;2;%lu;%lu;%lum"
  let &t_8b="\<Esc>[48;2;%lu;%lu;%lum"
  set termguicolors
endif
set background=dark
autocmd ColorScheme * highlight LineNr guibg=None
autocmd ColorScheme * highlight EndOfBuffer guibg=None
colorscheme github

let mapleader = ' '

if (!exists('*SourceConfig'))
  function SourceConfig() abort
    for f in split(glob('~/.config/nvim/autoload/*'), '\n')
      exe 'source' f
    endfor
    source $MYVIMRC
  endfunction
endif

" init.vim
nnoremap <silent> <Leader>ve :e $MYVIMRC<cr>
nnoremap <silent> <Leader>vs :call SourceConfig()<cr>

" fzf
nnoremap <silent> <Leader>p :Files<cr>
nnoremap <silent> <Leader>b :Buffers<cr>

" Explore
let g:netrw_altfile = 1
let g:netrw_sizestyle = "h"
nnoremap <silent> <Leader>ee :Explore<cr> "
function! OpenExploreInSplit(vertical)
  if a:vertical
    :vsplit
  else
    :split
  endif
  :Explore
endfunction
nnoremap <silent> <Leader>es :call OpenExploreInSplit(0)<cr>
nnoremap <silent> <Leader>evs :call OpenExploreInSplit(1)<cr>

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
