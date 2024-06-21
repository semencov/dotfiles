# Hide username in prompt
export DEFAULT_USER=$(whoami)
export GITHUB_USER="semencov"

# Locale
export LC_ALL=en_US.UTF-8
export LANG="en_US"

export GPG_TTY="$(tty)"

if command -v brew 1>/dev/null; then
  export HOMEBREW_PREFIX=$(brew --prefix)
  export HOMEBREW_NO_ENV_HINTS=true
fi

# Node.js Options
export NODE_OPTIONS="--max-old-space-size=6144 --trace-warnings"
# export NODE_TLS_REJECT_UNAUTHORIZED=0

# Sudoless npm https://github.com/sindresorhus/guides/blob/master/npm-global-without-sudo.md
export NPM_PACKAGES="${HOME}/.npm-global"
export NPM_CONFIG_PREFIX=$NPM_PACKAGES

if command -v brew 1>/dev/null; then
  export NODE_PACKAGE_MANAGER="pnpm"
else
  export NODE_PACKAGE_MANAGER="npm"
fi

# Preferred editor for local and remote sessions
if [[ -n $SSH_CONNECTION ]]; then
  export EDITOR='nano'
else
  export EDITOR='micro'
fi

if [[ -n $SSH_CONNECTION ]]; then
  export GUI_EDITOR=$EDITOR
else
  command -v bat >/dev/null 2>&1 && export GUI_EDITOR='code' || export GUI_EDITOR=$EDITOR
fi


# Don't clear the screen after quitting a manual page
export MANPAGER="sh -c 'col -bx | bat -l man -p'"

export PAGER="less -R"

# LS colors, made with http://geoff.greer.fm/lscolors/
export LSCOLORS="Gxfxcxdxbxegedabagacad"
export LS_COLORS='no=00:fi=00:di=01;34:ln=00;36:pi=40;33:so=01;35:do=01;35:bd=40;33;01:cd=40;33;01:or=41;33;01:ex=00;32:*.cmd=00;32:*.exe=01;32:*.com=01;32:*.bat=01;32:*.btm=01;32:*.dll=01;32:*.tar=00;31:*.tbz=00;31:*.tgz=00;31:*.rpm=00;31:*.deb=00;31:*.arj=00;31:*.taz=00;31:*.lzh=00;31:*.lzma=00;31:*.zip=00;31:*.zoo=00;31:*.z=00;31:*.Z=00;31:*.gz=00;31:*.bz2=00;31:*.tb2=00;31:*.tz2=00;31:*.tbz2=00;31:*.avi=01;35:*.bmp=01;35:*.fli=01;35:*.gif=01;35:*.jpg=01;35:*.jpeg=01;35:*.mng=01;35:*.mov=01;35:*.mpg=01;35:*.pcx=01;35:*.pbm=01;35:*.pgm=01;35:*.png=01;35:*.ppm=01;35:*.tga=01;35:*.tif=01;35:*.xbm=01;35:*.xpm=01;35:*.dl=01;35:*.gl=01;35:*.wmv=01;35:*.aiff=00;32:*.au=00;32:*.mid=00;32:*.mp3=00;32:*.ogg=00;32:*.voc=00;32:*.wav=00;32:*.patch=00;34:*.o=00;32:*.so=01;35:*.ko=01;31:*.la=00;33'

# Micro colors
export MICRO_TRUECOLOR=1

# git-friendly: disable bundle after pull
export GIT_FRIENDLY_NO_BUNDLE=true

# git-friendly: disable URL copying after push
export GIT_FRIENDLY_NO_COPY_URL_AFTER_PUSH=true

# Ripgrep config file location
export RIPGREP_CONFIG_PATH="$HOME/.ripgreprc"

# pj
export PROJECT_PATHS=(~/Projects)
