function! statusline#_gitbranch()
  return system('git rev-parse --abbrev-ref HEAD 2>/dev/null | tr -d "\n"')
endfunction

function! statusline#_gitstatusline()
  let l:branchname = statusline#_gitbranch()
  return strlen(l:branchname) > 0 ? ' ' . l:branchname . ' ' : ''
endfunction

function! statusline#_column()
  return col('.') > 80 ? '%#StatusLine# %c ' : '%c '
endfunction

function! statusline#_get()
  return ' %f %m %y '
        \ . statusline#_gitstatusline()
        \ . ' '
        \ . '%#LineNr#%='
        \ . '%l,' . statusline#_column()
endfunction

function! statusline#_init()
  set statusline=%!statusline#_get()
endfunction
