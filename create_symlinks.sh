#!/bin/bash

directories=(nvim yabai karabiner pgcli)
files=(.zshrc .skhdrc .gitconfig)

for directory in ${directories[@]}; do
  if test -d ~/.config/$directory; then
    echo "remove ~/.config/$directory"
    rm -rf ~/.config/$directory
  fi
  echo "create symlink from ~/git/dotfiles/$directory to ~/.config/$directory \n"
  ln -s ~/git/dotfiles/$directory ~/.config/$directory
done

for file in ${files[@]}; do
  if test -f ~/$file; then
    echo "remove ~/$file"
    rm ~/$file
  fi
  echo "create symlink from ~/git/dotfiles/$file to ~/$file \n"
  ln -s ~/git/dotfiles/$file ~/$file
done

