if [ "$SSH_TTY" ]; then
    if command -v zsh >/dev/null; then
        export SHELL=$(which zsh)
        exec $(which zsh) -l -i
    fi
fi

# Added by LM Studio CLI (lms)
export PATH="$PATH:/Users/yuri.sementsov/.cache/lm-studio/bin"
# End of LM Studio CLI section

