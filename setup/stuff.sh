#!/bin/bash

# Installs Homebrew, Git, git-extras, git-friendly, hub, Node.js, etc.

# Ask for the administrator password upfront
sudo -v

# Install Homebrew
command -v brew >/dev/null 2>&1 || bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"

# Update Homebrew and already installed packages
brew update

# GNU core utilities (those that come with macOS are outdated)
brew install coreutils

# GNU `find`, `locate`, `updatedb`, and `xargs`, g-prefixed
brew install findutils
brew install tree

# Manage compile and link flags for libraries
brew install autoconf pkg-config

# Git
brew install git
brew install git-extras
brew install git-flow
brew install gist
brew install github/gh/gh
# git-friendly
curl -sS https://raw.githubusercontent.com/jamiew/git-friendly/master/install.sh | bash

# Extend global $PATH
echo -e "setenv PATH $HOME/.dotfiles/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin" | sudo tee /etc/launchd.conf

# Everything else
brew install ripgrep
brew install tldr
brew install zsh-syntax-highlighting
brew install fd
brew install fzf && $(brew --prefix)/opt/fzf/install
brew install -s bat
brew install htop
brew install mc
brew install micro
brew install pwgen
brew install httpie
brew install ncdu
brew install mackup

# Fonts
brew cask install font-fira-code
brew cask install font-fira-mono
brew cask install font-powerline-symbols
brew cask install font-powerline-symbols
brew cask install font-inter

# Node
command -v node >/dev/null 2>&1 || brew install node

# NVM
brew install nvm
if [ -s "$(brew --prefix)/opt/nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    . "$(brew --prefix)/opt/nvm/nvm.sh"

    nvm install --lts
    nvm alias default node
fi

# Sudoless npm https://github.com/sindresorhus/guides/blob/master/npm-global-without-sudo.md
NPM_PACKAGES="$HOME/.nvm/global"
NPM_CONFIG_PREFIX=$NPM_PACKAGES

npm config set loglevel warn

# Npm
npm i -g npm-upgrade
npm i -g npm-check-updates
npm i -g yarn@legacy

npm i -g lerna
npm i -g regexgen
npm i -g @lhci/cli
npm i -g pageres-cli
npm i -g broken-link-checker
npm i -g @fabiospampinato/bump

npm i -g @vue/cli
npm i -g gatsby-cli
npm i -g preact-cli
npm i -g serverless
npm i -g @maizzle/cli
npm i -g @gridsome/cli
npm i -g create-nuxt-app
npm i -g create-react-app

npm i -g now
npm i -g surge
npm i -g netlify-cli
npm i -g @zeplin/cli
npm i -g @aws-amplify/cli

# Remove outdated versions from the cellar
brew cleanup
brew doctor
