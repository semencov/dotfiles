#!/bin/bash

# fnm, Node version manager
fnm install --lts

# Setup NPM initial settings
npm config set loglevel error
npm config set init-author-name "Yuri Sementsov"
npm config set init-author-email "hello@smcv.dev"
npm config set init-author-url "https://smcv.dev"
npm config set init-license "MIT"
npm config set init-version "0.0.1"
npm config set fund false
npm config set audit false

# Npm
npm i -g zx
npm i -g npm-upgrade
npm i -g npm-check
npm i -g npkill
npm i -g tldr
npm i -g quicktype

npm i -g yarn@legacy
npm i -g serve
npm i -g lerna
npm i -g @lhci/cli
npm i -g pageres-cli
npm i -g broken-link-checker
npm i -g @fabiospampinato/bump
npm i -g @marp-team/marp-cli

npm i -g @vue/cli
npm i -g gatsby-cli
npm i -g preact-cli
npm i -g serverless
npm i -g @maizzle/cli
npm i -g @gridsome/cli
npm i -g @11ty/eleventy
npm i -g create-nuxt-app
npm i -g create-react-app

npm i -g vercel
npm i -g surge
npm i -g netlify-cli
npm i -g @zeplin/cli
npm i -g @aws-amplify/cli
