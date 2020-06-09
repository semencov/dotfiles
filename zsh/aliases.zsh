# Enable aliases to be sudo’ed
alias sudo="sudo "

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
alias pjo="pj open"

# ls
alias ls='ls -G'
alias l='ls -lAh'
[[ -n ${PAGER} ]] && alias lm="l | ${PAGER}"
alias ll='ls -lh'
alias lt='ll -tr'
alias la='ll -A'
alias lc='lt -c'
alias lu='lt -u'

# rm
alias rm="rm -i"
alias rmf="rm -rf"

# Permissions
alias -- +x="chmod +x"

# GitHub Desktop
alias gh="github"

# Bat: https://github.com/sharkdp/bat
command -v bat >/dev/null 2>&1 && alias cat="bat --style=numbers,changes"

# Download file and save it with filename of remote file
alias get="curl -O -L"

# Download remote page with all assets
alias getpage="wget --adjust-extension --convert-links --page-requisites --span-hosts --no-host-directories"

# Run npm script without annoying noise
alias nr="npm run --silent"

# Jest watch
alias j="npx jest --watch"

# Misc
alias removehost="ssh-keygen -R"
alias which-command="whence"
alias rgl='rg -l'
alias rga='rg --no-ignore'
alias copykey='command cat ~/.ssh/id_rsa.pub | cb'

# Git
alias g="git"
alias gc="git checkout"
alias gaa="git add --all && git status -sb"
alias gst="git status -sb"
alias gpo="git push origin"
alias gm="git merge"
alias gr='git rev-parse 2>/dev/null && cd "./$(git rev-parse --show-cdup)"'
alias glog="git log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"
alias nah='git reset --hard; git clean -df'

# Gist
# gist-paste filename.ext -- create private Gist from the clipboard contents
alias gist-paste="gist --private --copy --paste --filename"
# gist-file filename.ext -- create private Gist from a file
alias gist-file="gist --private --copy"

# PHP
alias art="php artisan"
alias c="composer"
alias cu="composer update"
alias cr="composer require"
alias ci="composer install"
alias cgr="composer global require"
alias cda="composer dump-autoload -o"

# lsof
alias lstcp='sudo lsof -iTCP -sTCP:LISTEN -P -n'
alias lsudp='sudo lsof -iUDP -P -n'

# Search and Clean
alias brokenlinks='find . -type l -exec sh -c "file -b {} | grep -q ^broken" \; -print'
alias cleanup="find . -type f -name '*.DS_Store' -ls -delete"

# Edit configs
alias zshrc="$EDITOR $HOME/.zshrc"
alias sshconfig="$EDITOR $HOME/.ssh/config"
alias hostfile="sudo $EDITOR /etc/hosts"
alias dotfiles="$EDITOR $HOME/.dotfiles"

# Make a directory and cd to it
take() {
  mkdir -p $@ && cd ${@:$#}
}

# Cd to Git repository root folder
gr() {
  cd "./$(git rev-parse --show-cdup 2>/dev/null)" 2>/dev/null
}

# git clone and cd to a repo directory
clone() {
  git clone $@
  if [ "$2" ]; then
    cd "$2"
  else
    cd $(basename "$1" .git)
  fi
  if [[ -r "./yarn.lock" ]]; then
    yarn
  elif [[ -r "./package-lock.json" ]]; then
    npm install
  fi
}
