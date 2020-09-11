function! statusline#_column()
  return col('.') > 80 ? '%#StatusLine# %c ' : '%c '
endfunction

function! statusline#_get()
  return ' %t%m %y '
        \ . '%{FugitiveHead()} '
        \ . '%#LineNr#%='
        \ . '%l,' . statusline#_column()
endfunction

function! statusline#_init()
  set statusline=%!statusline#_get()
endfunction
