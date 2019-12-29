#!/bin/bash

#
#     ███████╗██╗   ██╗███╗   ███╗██╗     ██╗███╗   ██╗██╗  ██╗███████╗
#     ██╔════╝╚██╗ ██╔╝████╗ ████║██║     ██║████╗  ██║██║ ██╔╝██╔════╝
#     ███████╗ ╚████╔╝ ██╔████╔██║██║     ██║██╔██╗ ██║█████╔╝ ███████╗
#     ╚════██║  ╚██╔╝  ██║╚██╔╝██║██║     ██║██║╚██╗██║██╔═██╗ ╚════██║
#     ███████║   ██║   ██║ ╚═╝ ██║███████╗██║██║ ╚████║██║  ██╗███████║
#     ╚══════╝   ╚═╝   ╚═╝     ╚═╝╚══════╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝
#


directories=(nvim yabai karabiner pgcli)
files=(.zshrc .skhdrc .gitconfig)

red="\033[0;31m"
green="\033[0;32m"
nocolor="\033[0m"


printf "create symlinks for .config directories... \n"
for directory in ${directories[@]}; do
  if test -d ~/.config/$directory; then
    printf "${red}remove ~/.config/$directory\n"
    rm -rf ~/.config/$directory
  fi
  printf "${green}create symlink from ~/dotfiles/$directory to ~/.config/$directory\n"
  ln -s ~/dotfiles/$directory ~/.config/$directory
done

printf "\n${nocolor}create symlinks for dotfiles... \n"
for file in ${files[@]}; do
  if test -f ~/$file; then
    printf "${red}remove ~/$file\n"
    rm ~/$file
  fi
  printf "${green}create symlink from ~/dotfiles/$file to ~/$file\n"
  ln -s ~/dotfiles/$file ~/$file
done

