#!/bin/bash

# fnm, Node version manager
fnm install --lts

# Setup NPM initial settings
[ -d "${HOME}/.npm-global" ] || mkdir "${HOME}/.npm-global"
npm config set prefix "${HOME}/.npm-global"
npm config set loglevel error
npm config set init-author-name "Yuri Sementsov"
npm config set init-author-email "hello@smcv.dev"
npm config set init-author-url "https://smcv.dev"
npm config set init-license "MIT"
npm config set init-version "0.0.1"
npm config set fund false
npm config set audit false

# Npm
npm install --global \
  zx \
  yarn@legacy \
  npm-upgrade \
  npm-check \
  npkill \
  tldr \
  quicktype \
  serve \
  lerna \
  @lhci/cli \
  pageres-cli \
  broken-link-checker \
  @fabiospampinato/bump \
  @marp-team/marp-cli \
  @vue/cli \
  gatsby-cli \
  preact-cli \
  serverless \
  @maizzle/cli \
  @gridsome/cli \
  @11ty/eleventy \
  create-nuxt-app \
  create-react-app \
  vercel \
  surge \
  netlify-cli \
  @zeplin/cli \
  @aws-amplify/cli

sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}
