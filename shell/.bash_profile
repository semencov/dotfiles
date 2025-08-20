if [ "$SSH_TTY" && -f "/bin/zsh" ]; then
  export SHELL=/bin/zsh
  exec /bin/zsh -l
fi
