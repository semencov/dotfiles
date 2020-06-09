# Dotfiles

My personal dotfiles. It contains the installation of some basic tools, some handy aliases and functions. Backups of settings are done via [Mackup](https://github.com/lra/mackup).

You can install them by cloning the repository as `.dotfiles` in your home directory and running the bootstrap scripts.

1. [`./bootstrap`](https://github.com/semencov/dotfiles/blob/master/bootstrap) — will setup common environment (including ZSH and Oh-My-Zsh!, Homebrew, Node.js, PHP, Valet), as well as install some useful tools.
2. [`./macos/set-defaults.sh`](https://github.com/semencov/dotfiles/blob/master/macos/set-defaults.sh) — will set macOS defaults and settings.
3. [`./macos/install-apps.sh`](https://github.com/semencov/dotfiles/blob/master/macos/install-apps.sh) — installs some useful apps from Homebrew Cask.

![screenshot](https://raw.githubusercontent.com/semencov/dotfiles/master/screenshot.png)

## Installation

(Fork this repository if you want to use my dotfiles.)

Prerequisites:

1. [Install Xcode Command Line Tools](http://railsapps.github.io/xcode-command-line-tools.html).
2. [Generate SSH key](https://help.github.com/articles/generating-ssh-keys/).
3. [Install Homebrew](http://brew.sh/).

Then run these commands in the terminal:

```
brew install git
brew install n
n lts
git clone git@github.com:semencov/dotfiles.git ~/.dotfiles
cd ~/.dotfiles
./sync.py
npm install
```

Now you can run scripts like `setup/zsh.sh` or `setup/osx.sh` to install other stuff.

## Updating

```bash
dotfiles
```

## Notes

You can use any file extensions in `tilde/` to invoke proper syntax highlighting in code editor.

## Further customization

- Add any zsh profile customizations to `~/.zshlocal`.
- Add your git username/email/etc. to `~/.gitlocal`.
