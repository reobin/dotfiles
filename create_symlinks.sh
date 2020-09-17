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


directories=(nvim yabai karabiner pgcli alacritty)
root_files=(zsh/.zshrc .skhdrc .gitconfig .vimrc .tmux.conf)

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
  printf "${green}create symlink from ~/dotfiles/%s to ~/.config/%s" "$directory" "$directory"
  ln -s "$HOME/dotfiles/$directory" "$HOME/.config/$directory"
  printf "\n\n"
done

printf "\n${yellow}create symlinks for dotfiles... \n"
for file in "${root_files[@]}"; do
  file_name="$(basename -- $file)"
  if test -f "$HOME/$file_name"; then
    printf "${red}remove ~/%s\n" "$file_name"
    rm "$HOME/$file_name"
  fi
  printf "${green}create symlink from ~/dotfiles/%s to ~/%s" "$file" "$file_name"
  ln -s "$HOME/dotfiles/$file" "$HOME/$file_name"
  printf "\n\n"
done

printf "\n${yellow}done\n"
