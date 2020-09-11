function! format#_run()
  let l:fileextension = tolower(expand('%:e'))
  if index(["ts", "tsx", "js", "jsx", "json", "md"], l:fileextension) >= 0
    :!prettier --write '%'
  elseif l:fileextension == "py"
    :!black '%'
  elseif index(["ex", "exs"], l:fileextension) >= 0
    :!mix format '%'
  endif
endfunction
function! format#_init()
  nnoremap <silent> <Leader>f :call format#_run()<cr>
endfunction
