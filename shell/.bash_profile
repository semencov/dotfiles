if [ "$SSH_TTY" ]; then
  export SHELL=/bin/zsh
  exec /bin/zsh -l
fi
# Added by LM Studio CLI (lms)
export PATH="$PATH:/Users/yuri.sementsov/.cache/lm-studio/bin"
