#!/bin/bash

#
#     ███████╗██╗   ██╗███╗   ███╗██╗     ██╗███╗   ██╗██╗  ██╗███████╗
#     ██╔════╝╚██╗ ██╔╝████╗ ████║██║     ██║████╗  ██║██║ ██╔╝██╔════╝
#     ███████╗ ╚████╔╝ ██╔████╔██║██║     ██║██╔██╗ ██║█████╔╝ ███████╗
#     ╚════██║  ╚██╔╝  ██║╚██╔╝██║██║     ██║██║╚██╗██║██╔═██╗ ╚════██║
#     ███████║   ██║   ██║ ╚═╝ ██║███████╗██║██║ ╚████║██║  ██╗███████║
#     ╚══════╝   ╚═╝   ╚═╝     ╚═╝╚══════╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝
#
#     Creates symlinks enabling centralized dotfile management
#


directories=(nvim yabai karabiner pgcli)
files=(.zshrc .skhdrc .gitconfig)

red="\033[0;31m"
green="\033[0;32m"
yellow="\033[0;33m"
nocolor="\033[0m"

printf "${yellow}create symlinks for .config directories... \n"
for directory in "${directories[@]}"; do
  if test -d "$HOME/.config/$directory"; then
    printf "${red}remove ~/.config/%s\n" "$directory"
    rm -rf "$HOME/.config/$directory"
  fi
  printf "${green}create symlink from ~/dotfiles/%s to ~/.config/%s\n\n" "$directory" "$directory"
  ln -s "$HOME/dotfiles/$directory" "$HOME/.config/$directory"
done

printf "\n${yellow}create symlinks for dotfiles... \n"
for file in "${files[@]}"; do
  if test -f "$HOME/$file"; then
    printf "${red}remove ~/%s\n" "$file"
    rm "$HOME/$file"
  fi
  printf "${green}create symlink from ~/dotfiles/%s to ~/%s\n\n" "$file" "$file"
  ln -s "$HOME/dotfiles/$file" "$HOME/$file"
done

printf "\n${yellow}done\n"
