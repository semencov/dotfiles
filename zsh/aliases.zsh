# Enable aliases to be sudo’ed
alias sudo="sudo "

# Print $PATH as list
alias path="echo $PATH | tr ':' '\n' | nl"

# Navigation
alias ~="cd ~"
alias ..="cd .."
alias ...="cd ../.."
alias ....="cd ../../.."
alias .....="cd ../../../.."
alias -- -="cd -"

# Shortcuts
alias o="open"
alias oo="open ."
alias e="$EDITOR"
alias ee="$EDITOR ."
alias c="$GUI_EDITOR"
alias cc="$GUI_EDITOR ."

# ls
alias ls='eza -G'
alias l='eza -1 --group-directories-first'
alias ll='eza -l -I .git --git-ignore --group-directories-first --no-user'
alias la='eza -la --group-directories-first --no-user'
alias llm='eza -la -smodified --git-ignore -I .git'
alias lls='eza -la -ssize --git-ignore -I .git'

# rm
alias rm="rm -i"
alias rmf="rm -rfv"

# Permissions
alias -- +x="chmod +x"

# Bat: https://github.com/sharkdp/bat
command -v bat >/dev/null 2>&1 && alias cat="bat --style=numbers,changes --paging=never"

# Download file and save it with filename of remote file
alias get="curl -O -L"

# Download remote page with all assets
alias getpage="wget --adjust-extension --convert-links --page-requisites --span-hosts --no-host-directories"

# Jest watch
alias j="npx jest --watch"

# Misc
alias removehost="ssh-keygen -R"
alias which-command="whence"
alias rgl='rg -l'
alias rga='rg --hidden --no-ignore'
alias fda='fd --hidden --no-ignore'
alias copykey='command cat ~/.ssh/id_rsa.pub | cb'

# Git
alias g="git"
alias gc="git checkout"
alias gaa="git add --all && git status -sb"
alias gst="git status -sb"
alias gpo="git push origin"
alias gm="git merge"
# alias gr='git rev-parse 2>/dev/null && cd "./$(git rev-parse --show-cdup)"'
alias glog="git log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"
alias nah='git reset --hard; git clean -df'
alias br="branch"

# Gist
# gist-paste filename.ext -- create private Gist from the clipboard contents
alias gist-paste="gist --private --copy --paste --filename"
# gist-file filename.ext -- create private Gist from a file
alias gist-file="gist --private --copy"

# lsof
alias lstcp='sudo lsof -iTCP -sTCP:LISTEN -P -n'
alias lsudp='sudo lsof -iUDP -P -n'

# Search and Clean
alias brokenlinks='find . -type l -exec sh -c "file -b {} | grep -q ^broken" \; -print'
alias cleanup="find . -type f -name '*.DS_Store' -ls -delete"

# Edit configs
alias zs="source ~/.zshrc"
alias zshrc="$EDITOR $HOME/.zshrc"
alias sshconfig="$EDITOR $HOME/.ssh/config"
alias hostfile="sudo $EDITOR /etc/hosts"
alias dotfiles="$GUI_EDITOR $HOME/.dotfiles"

t() {
  # Defaults to 3 levels deep, do more with `t . 5` or `t . 1`
  # pass additional args after
  tree -I '.git|node_modules|bower_components|vendor|.DS_Store' --dirsfirst --filelimit 50 -L ${2:-3} -aC $1
}

# Make a directory and cd to it
take() {
  mkdir -p $@ && cd ${@:$#}
}

# Cd to Git repository root folder
gr() {
  cd "./$(git rev-parse --show-cdup 2>/dev/null)" 2>/dev/null
}

# shortcut to the project's package manager
np() {
  if [[ -r "./yarn.lock" ]]; then
    yarn $@
  elif [[ -r "./pnpm-lock.yaml" ]]; then
    pnpm $@
  else
    npm $@
  fi
}

# Run npm script without annoying noise
nr() {
  np run --silent $@
}

# git clone and cd to a repo directory
clone() {
  git clone $@
  if [ "$2" ]; then
    cd "$2"
  else
    cd $(basename "$1" .git)
  fi

  np install
}
