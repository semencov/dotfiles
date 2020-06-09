#!/bin/bash

# Installs quick look plugins

brew cask install qlcolorcode
brew cask install qlmarkdown
brew cask install qlstephen
brew cask install qlvideo
brew cask install quicklook-csv
brew cask install quicklook-json
brew cask install quicklookapk
brew cask install quicklookase
brew cask install webpquicklook
brew cask install suspicious-package

# qlImageSize
TMPDIR=$(mktemp -d) && {
  cd $TMPDIR
  curl -o _.zip http://cloud.github.com/downloads/Nyx0uf/qlImageSize/qlImageSize.qlgenerator.zip
  unzip -d ~/Library/QuickLook _.zip
  rm -rf $TMPDIR
}

qlmanage -r
