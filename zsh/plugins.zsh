if [ -d "$HOMEBREW_PREFIX" ]; then
    source $HOMEBREW_PREFIX/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
    source $HOMEBREW_PREFIX/share/zsh-autosuggestions/zsh-autosuggestions.zsh
fi

source $HOME/.dotfiles/zsh/plugins/pj/pj.plugin.zsh
source $HOME/.dotfiles/zsh/plugins/npm-scripts/npm-scripts-autocomplete.plugin.zsh
