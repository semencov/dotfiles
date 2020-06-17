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

PATH='/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:./node_modules/.bin'

[ -d "/home/linuxbrew/.linuxbrew/bin" ] && _prepend_path "/home/linuxbrew/.linuxbrew/bin"
[ -d "$NPM_PACKAGES/bin" ] && _prepend_path "$NPM_PACKAGES/bin"
[ -d /usr/local/bin ] && _prepend_path "/usr/local/bin"
[ -d /usr/local/opt/ruby/bin ] && _prepend_path "/usr/local/opt/ruby/bin"
[ -d /usr/local/opt/coreutils/libexec/gnubin ] && _prepend_path "/usr/local/opt/coreutils/libexec/gnubin"
[ -d ~/.dotfiles/bin ] && _prepend_path "$HOME/.dotfiles/bin"
[ -d ~/.composer/vendor/bin ] && _prepend_path "$HOME/.composer/vendor/bin"
[ -d ~/bin ] && _prepend_path "$HOME/bin"

export PATH
