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

[ -d ~/.bin ] && _prepend_path "$HOME/.bin"
[ -d ~/.local/bin ] && _prepend_path "$HOME/.local/bin"
[ -d ~/.dotfiles/bin ] && _prepend_path "$HOME/.dotfiles/bin"
[ -d /opt/homebrew/bin ] && _prepend_path "/opt/homebrew/bin"
[ -d /opt/homebrew/sbin ] && _prepend_path "/opt/homebrew/sbin"
[ -d /usr/local/bin ] && _prepend_path "/usr/local/bin"
[ -d /usr/local/opt/ruby/bin ] && _prepend_path "/usr/local/opt/ruby/bin"
[ -d ~/.fnm ] && _prepend_path "$HOME/.fnm"
[ -d "$NPM_PACKAGES/bin" ] && _prepend_path "$NPM_PACKAGES/bin"
[ -d "$PNPM_HOME" ] && _prepend_path "$PNPM_HOME"
[ -d ~/.bun/bin ] && _prepend_path "$HOME/.bun/bin"
[ -d ~/.composer/vendor/bin ] && _prepend_path "$HOME/.composer/vendor/bin"
[ -d ~/.lando/bin ] && _prepend_path "$HOME/.lando/bin"
[ -d ~/.cache/lm-studio/bin ] && _prepend_path "$HOME/.cache/lm-studio/bin"

export PATH
