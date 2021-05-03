#!/usr/bin/env bash

command -v brew >/dev/null 2>&1 || { echo >&2 "Install Homebrew first. Run this to install: \n/bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""; exit 1; }

if ! command -v chromedriver >/dev/null; then
  brew install chromedriver
  xattr -d com.apple.quarantine  /usr/local/bin/chromedriver
fi

LATEST_RELEASE=`curl -s https://chromedriver.storage.googleapis.com/LATEST_RELEASE`
CURRENT_RELEASE=`chromedriver --version | awk '{print $2}'`

if [ "$LATEST_RELEASE" != "$CURRENT_RELEASE" ]; then
  brew upgrade chromedriver
  xattr -d com.apple.quarantine  /usr/local/bin/chromedriver
fi

echo "Using $(chromedriver --version)"

chromedriver --port=4444 --verbose --whitelisted-ips= --url-base=wd/hub
