# Dotfiles

My personal dotfiles. It contains the installation of some basic tools, some handy aliases and functions. Backups of settings are done via [Mackup](https://github.com/lra/mackup).

![screenshot](https://raw.githubusercontent.com/semencov/dotfiles/master/screenshot.png)

## Installation

Prerequisites:

1. [Install Xcode Command Line Tools](http://railsapps.github.io/xcode-command-line-tools.html).

Then run these commands in the terminal:

```sh
bash -c "$(curl -fsSL https://raw.githubusercontent.com/semencov/dotfiles/master/install.sh)"
```

Now you can run scripts like `setup/zsh.sh` or `setup/osx.sh` to install other stuff.

## Updating

```sh
dotfiles
```

## Further customization

- Add any zsh profile customizations to `~/.zshlocal`.
- Add your git username/email/etc. to `~/.gitlocal`.
