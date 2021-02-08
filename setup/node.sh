#!/bin/bash

# n, Node version manager
n lts
npm config set loglevel warn

# Npm
npm i -g npm-upgrade
npm i -g npm-check
npm i -g npkill
npm i -g tldr

npm i -g yarn@legacy
npm i -g lerna
npm i -g regexgen
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
