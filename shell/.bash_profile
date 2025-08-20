if [ "$SSH_TTY" ]; then
    if [ -f "/bin/zsh" ]; then
        export SHELL=/bin/zsh
        exec /bin/zsh -l -i
    fi
fi
