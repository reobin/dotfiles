" Reload init.vim & all files in the ~/.config/nvim/autoload directory
if (!exists('*utils#source_config'))
  function! utils#source_config() abort
    for file in split(glob('~/.config/nvim/autoload/*'), '\n')
      exe 'source' file
    endfor
    source $MYVIMRC
  endfunction
endif

function! utils#format()
  let l:fileextension = tolower(expand('%:e'))
  if index(["ts", "tsx", "js", "jsx", "json", "vue", "md", "css", "scss", "html"], l:fileextension) >= 0
    :!prettier --write '%'
  elseif l:fileextension == "py"
    :!black '%'
  elseif index(["ex", "exs"], l:fileextension) >= 0
    :!mix format '%'
  elseif index(["go"], l:fileextension) >= 0
    :!go fmt '%'
  elseif l:fileextension == "php"
    :!php-cs-fixer fix --rules=@PSR2 '%'
  else
    :echo "file extension not supported"
  endif
endfunction
