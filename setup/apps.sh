#!/usr/bin/env bash

# Install Typography Keyboard Layout
brew cask install ilya-birman-typography-layout

# Install iTerm
brew cask install iterm2

# Install Visual Studio Code
brew cask install visual-studio-code

# Install Sublime Text
brew cask install sublime-text

# Install Firefox & Chrome
brew cask install firefox google-chrome

# Install Sequel Pro
brew cask install sequel-pro

# Install Numi
brew cask install numi

echo
confirm "Install Dropbox?" && brew cask install dropbox

echo
confirm "Install Insomnia?" && brew cask install insomnia

echo
confirm "Install JetBrains Toolbox?" && brew cask install jetbrains-toolbox

echo
confirm "Install OSXFuse? [y/N]" && brew cask install osxfuse

echo
