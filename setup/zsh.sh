#!/bin/bash

# Install Homebrew
command -v brew >/dev/null 2>&1 || bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"

# Update Homebrew and already installed packages
brew update

# Installs zsh, registers zsh as a default shell
brew install zsh
brew install starship
brew install zsh-syntax-highlighting

zsh_path=$(which zsh)
grep -Fxq "$zsh_path" /etc/shells || sudo bash -c "echo $zsh_path >> /etc/shells"
chsh -s "$zsh_path" $USER
