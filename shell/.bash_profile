if [ "$SSH_TTY" ]; then
    if command -v zsh >/dev/null; then
        export SHELL=$(which zsh)
        exec $(which zsh) -l -i
    fi
fi
