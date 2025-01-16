#!/bin/bash

# fnm, Node version manager
fnm install --lts
fnm default system
fnm use default

# Setup NPM initial settings
[ -d "${HOME}/.npm-global" ] || mkdir "${HOME}/.npm-global"
[ -d "${HOME}/.pnpm-global" ] || mkdir "${HOME}/.pnpm-global"

npm config set prefix "${HOME}/.npm-global"
npm config set loglevel error
npm config set init-author-name "Yuri Sementsov"
npm config set init-author-email "hello@smcv.dev"
npm config set init-author-url "https://smcv.dev"
npm config set init-license "MIT"
npm config set init-version "1.0.0"
npm config set fund false
npm config set audit false

corepack enable
corepack enable npm

# Npm
npm install --global \
  zx \
  yarn@legacy \
  vercel \
  typescript \
  tsx \
  tldr \
  surge \
  serve \
  qnm \
  pnpm \
  npm-upgrade \
  npm-check \
  npkill \
  lerna \
  degit \
  @lhci/cli \
  @biomejs/biome
