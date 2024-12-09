if [ "$SSH_TTY" ]; then
  export SHELL=/bin/zsh
  exec /bin/zsh -l
fi