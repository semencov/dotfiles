fpath=($HOME/.zfunctions $HOME/.dotfiles/zsh/functions $fpath)

# Prepend $PATH without duplicates
function _prepend_path() {
  if ! $(echo "$PATH" | tr ":" "\n" | grep -qx "$1"); then
    PATH="$1:$PATH"
  fi
}

# Construct $PATH
# 1. Default paths
# 2. ./node_modules/.bin - shorcut to run locally installed Node bins
# 3. Custom bin folder for n, Ruby, CoreUtils, dotfiles, etc.

export PNPM_HOME="$HOME/.pnpm-global"

PATH='/usr/local/bin:/usr/local/sbin:/usr/bin:/bin:/usr/sbin:/sbin:./node_modules/.bin'

[ -d "/opt/homebrew/bin" ] && _prepend_path "/opt/homebrew/bin"
[ -d "/opt/homebrew/sbin" ] && _prepend_path "/opt/homebrew/sbin"
[ -d "$NPM_PACKAGES/bin" ] && _prepend_path "$NPM_PACKAGES/bin"
[ -d ~/.fnm ] && _prepend_path "$HOME/.fnm"
[ -d /usr/local/bin ] && _prepend_path "/usr/local/bin"
[ -d /usr/local/opt/ruby/bin ] && _prepend_path "/usr/local/opt/ruby/bin"
[ -d /usr/local/opt/coreutils/libexec/gnubin ] && _prepend_path "/usr/local/opt/coreutils/libexec/gnubin"
[ -d ~/.dotfiles/bin ] && _prepend_path "$HOME/.dotfiles/bin"
[ -d ~/.composer/vendor/bin ] && _prepend_path "$HOME/.composer/vendor/bin"
[ -d ~/.lando/bin ] && _prepend_path "$HOME/.lando/bin"
[ -d ~/.npm-global/bin ] && _prepend_path "$HOME/.npm-global/bin"
[ -d "$PNPM_HOME" ] && _prepend_path "$PNPM_HOME"
[ -d ~/.bin ] && _prepend_path "$HOME/.bin"

export PATH
