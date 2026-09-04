# Utility commands

> Generated from `config/commands.json` and executable `--help` output. Do not edit manually.

## cb

Read or write the system clipboard

Platforms: macos, ubuntu, debian. External tools: `pbcopy`, `pbpaste`, `xclip`.

```text
Usage: cb
```

## chromedriver

Run the installed ChromeDriver service

Platforms: macos. External tools: `chromedriver`, `xattr`.

```text
Usage: chromedriver [port]
```

## clbin

Publish standard input to clbin.com

Platforms: macos, ubuntu, debian. External tools: None.

```text
Usage: clbin
```

## cleandropbox

Find or remove Dropbox conflicted copies

Platforms: macos, ubuntu, debian. External tools: None.

```text
Usage: cleandropbox [--remove]
```

## codepoint

Print a character Unicode code point

Platforms: macos, ubuntu, debian. External tools: None.

```text
Usage: codepoint <character>
```

## confirm

Request terminal confirmation

Platforms: macos, ubuntu, debian. External tools: None.

```text
Usage: confirm [message]
```

## crlf

Find or normalize CRLF files

Platforms: macos, ubuntu, debian. External tools: None.

```text
Usage: crlf [--force] [file]
```

## domains

Check generated domain names through DNS

Platforms: macos, ubuntu, debian. External tools: None.

```text
Usage: domains [suffix]
```

## dotfiles

Manage machine setup and synchronized state

Platforms: macos, ubuntu, debian. External tools: `chezmoi`, `git`.

```text
Usage: dotfiles [options] [command]

Options:
  -h, --help        display help for command

Commands:
  setup [options]   Set up or reconfigure this machine
  apply [options]   Apply managed home state
  edit              Open the dotfiles repository
  sync [options]    Capture and publish managed home state
  update [options]  Update the environment and publish managed state
  help [command]    display help for command
```

## escape

Print UTF-8 bytes as hexadecimal escapes

Platforms: macos, ubuntu, debian. External tools: None.

```text
Usage: escape <text>
```

## extract

Extract a supported archive

Platforms: macos, ubuntu, debian. External tools: `7z`, `bunzip2`, `gunzip`, `tar`, `unrar`, `unzip`, `xz`.

```text
Usage: extract <archive>
```

## git-cleanup

Report or remove safely disposable Git branches

Platforms: macos, ubuntu, debian. External tools: `git`.

```text
Usage: git-cleanup [--force]
```

## git-diff-master

List files changed from the default branch

Platforms: macos, ubuntu, debian. External tools: `git`.

```text
Usage: git-diff-master [--inline] [pattern]
```

## git-fix-user

Inspect or repair Git identity in child repositories

Platforms: macos, ubuntu, debian. External tools: `git`.

```text
Usage: git-fix-user [-n <name>] [-e <email>]
```

## git-fork

Add a GitHub upstream remote

Platforms: macos, ubuntu, debian. External tools: `git`.

```text
Usage: git-fork <original-owner>
```

## git-github

Create and publish a GitHub repository

Platforms: macos, ubuntu, debian. External tools: `gh`, `git`.

```text
Usage: git-github [repository]
```

## git-pager

Page Git diffs through diff-so-fancy

Platforms: macos, ubuntu, debian. External tools: `diff-so-fancy`, `less`.

```text
Usage: git-pager
```

## git-standup

Show commits since the previous workday

Platforms: macos, ubuntu, debian. External tools: `git`.

```text
Usage: git-standup
```

## git-stats

Compare repository statistics between dates

Platforms: macos, ubuntu, debian. External tools: `cloc`, `git`.

```text
Usage: git-stats <start-date> <end-date>
```

## git-upstream

Synchronize a branch with its upstream remote

Platforms: macos, ubuntu, debian. External tools: `git`.

```text
Usage: git-upstream [branch]
```

## git-user

Inspect or set repository-local Git identity

Platforms: macos, ubuntu, debian. External tools: `git`.

```text
Usage: git-user [-n <name>] [-e <email>]
```

## gz

Compare gzip and Brotli compression sizes

Platforms: macos, ubuntu, debian. External tools: `brotli`, `gzip`.

```text
Usage: gz <file>
```

## headers

Show HTTP response headers

Platforms: macos, ubuntu, debian. External tools: None.

```text
Usage: headers <URL>
```

## help

List available dotfiles utility commands

Platforms: macos, ubuntu, debian. External tools: None.

```text
Usage: help [command]
```

## ip-geo

Show geolocation for an IP address

Platforms: macos, ubuntu, debian. External tools: None.

```text
Usage: ip-geo [--map] [IP]
```

## ip-lan

Print the local network IP address

Platforms: macos, ubuntu, debian. External tools: None.

```text
Usage: ip-lan
```

## ip-query

Query public information for an IP address

Platforms: macos, ubuntu, debian. External tools: None.

```text
Usage: ip-query [IP]
```

## ip-wan

Print the public IP address

Platforms: macos, ubuntu, debian. External tools: None.

```text
Usage: ip-wan
```

## lso

List files with octal permissions

Platforms: macos, ubuntu, debian. External tools: None.

```text
Usage: lso [path ...]
```

## passphrase

Generate a random word passphrase

Platforms: macos, ubuntu, debian. External tools: None.

```text
Usage: passphrase [--words <count>]
```

## pem

Generate a self-signed PEM certificate

Platforms: macos, ubuntu, debian. External tools: `openssl`.

```text
Usage: pem
```

## phpserver

Start a PHP development server

Platforms: macos, ubuntu, debian. External tools: `php`.

```text
Usage: phpserver [port]
```

## pj-archive

Archive project directories

Platforms: macos, ubuntu, debian. External tools: `7z`.

```text
Usage: pj-archive [--remove] <folder ...>
```

## pj-clean

Clean generated project files

Platforms: macos, ubuntu, debian. External tools: `git`.

```text
Usage: pj-clean [--force] <folder ...>
```

## pk

Create a supported archive

Platforms: macos, ubuntu, debian. External tools: `7z`, `bzip2`, `gzip`, `tar`, `zip`.

```text
Usage: pk <tbz|tgz|txz|tar|bz2|gz|zip|7z> [path]
```

## rename

Bulk-rename files by prefix

Platforms: macos, ubuntu, debian. External tools: None.

```text
Usage: rename [--force] <prefix> <replacement>
```

## repo

Find a local project directory

Platforms: macos, ubuntu, debian. External tools: None.

```text
Usage: repo <name>
```

## resetperm

Reset file and directory permissions

Platforms: macos, ubuntu, debian. External tools: None.

```text
Usage: resetperm --force [path]
```

## rsync-from

Mirror a remote path into the current directory

Platforms: macos, ubuntu, debian. External tools: `rsync`.

```text
Usage: rsync-from [--force] <remote>
```

## rsync-to

Mirror the current directory to a remote path

Platforms: macos, ubuntu, debian. External tools: `rsync`.

```text
Usage: rsync-to [--force] <remote>
```

## secret-delete

Delete a macOS Keychain environment secret

Platforms: macos. External tools: `security`.

```text
Usage: secret-delete <key>
```

## secret-get

Read a macOS Keychain environment secret

Platforms: macos. External tools: `security`.

```text
Usage: secret-get <key>
```

## secret-set

Write a macOS Keychain environment secret

Platforms: macos. External tools: `security`.

```text
Usage: secret-set <key> <value>
```

## server

Serve the current directory over HTTP

Platforms: macos, ubuntu, debian. External tools: None.

```text
Usage: server [port]
```

## ssh-add-host

Create and install an SSH host identity

Platforms: macos, ubuntu, debian. External tools: `ssh`, `ssh-keygen`.

```text
Usage: ssh-add-host [-a alias] [-u username] [-p port] <host>
```

## ssh-key

Print or generate an SSH public key

Platforms: macos, ubuntu, debian. External tools: `ssh-keygen`.

```text
Usage: ssh-key [identifier]
```

## starship-git-simple

Render compact Git prompt state

Platforms: macos, ubuntu, debian. External tools: `git`.

```text
Usage: starship-git-simple
```

## teams-active

Keep Microsoft Teams active

Platforms: macos. External tools: `osascript`.

```text
Usage: teams-active
```

## update-namecheap

Update a Namecheap dynamic DNS record

Platforms: macos, ubuntu, debian. External tools: None.

```text
Usage: update-namecheap -u <domain> -p <password> [-i <IP>] [-v] <host>
```

## wg

Replace text across ripgrep matches

Platforms: macos, ubuntu, debian. External tools: `rg`.

```text
Usage: wg <pattern> --replace|-r <replacement> [path ...]
```

## yolo

Generate and confirm a Git commit message

Platforms: macos, ubuntu, debian. External tools: `fx`, `git`.

```text
Usage: yolo
```

## zsh_history_fix

Repair a corrupted Zsh history file

Platforms: macos, ubuntu, debian. External tools: `strings`.

```text
Usage: zsh_history_fix --force
```
