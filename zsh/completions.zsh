# Caching autocompletion
# https://blog.callstack.io/supercharge-your-terminal-with-zsh-8b369d689770

fpath=(
  $HOMEBREW_PREFIX/share/zsh/functions
  $HOMEBREW_PREFIX/share/zsh/site-functions
  $HOMEBREW_PREFIX/share/zsh-completions
  $fpath
)

[ -d ~/.docker/completions ] && fpath=($HOME/.docker/completions $fpath)


# Load and initialize the completion system
autoload -Uz compinit

# Only regenerate the completion dump once a day
if [[ -n ~/.zcompdump(#qN.mh+24) ]]; then
  compinit -i
else
  compinit -C -i
fi

# Now that compinit is called, we can load the complist module
zmodload -i zsh/complist

# Set options for completion behavior
setopt auto_list
setopt auto_menu
setopt always_to_end

# Configure completion styles
zstyle ':completion:*' menu select
zstyle ':completion:*' group-name ''
zstyle ':completion:*' completer _expand _complete _ignored _approximate
zstyle ':completion:*' matcher-list 'm:{a-zA-Z-_}={A-Za-z_-}' 'r:|=*' 'l:|=* r:|=*'
zstyle ':completion:*' use-cache on
zstyle ':completion:*' cache-path $ZSH_CACHE_DIR

# Load git completion
autoload -Uz _git
zstyle ':completion:*:*:git:*' script $HOMEBREW_PREFIX/share/zsh/site-functions/_git

# Autocompletion for git-friendly
compdef __gitex_branch_names branch br

# Autocompletions for pnpm
[[ -f ~/.config/tabtab/zsh/__tabtab.zsh ]] && . ~/.config/tabtab/zsh/__tabtab.zsh || true
