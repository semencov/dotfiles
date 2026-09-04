# Dotfiles

Personal macOS workstation and Ubuntu/Debian development-server state. Chezmoi owns files under `$HOME`; a strict Bun/TypeScript CLI owns setup orchestration, validation, backups, and reruns.

![screenshot](https://raw.githubusercontent.com/semencov/dotfiles/HEAD/screenshot.png)

## Install

Run as the target user, never as root:

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/semencov/dotfiles/HEAD/install.sh)"
```

The bootstrap supports Apple Silicon and Intel macOS, plus arm64/x86-64 Ubuntu and Debian. It installs only bootstrap prerequisites, Bun, and chezmoi; clones the canonical HTTPS repository; installs locked CLI dependencies; then opens the interactive setup wizard.

For headless setup, pass arguments after the Bash `--` separator:

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/semencov/dotfiles/HEAD/install.sh)" -- \
  --non-interactive \
  --select core-tools,git \
  --skip homebrew-packages,shell
```

Rerun the installer or use `dotfiles setup` to reconfigure the machine. Use `dotfiles apply --dry-run` to inspect managed-home changes and `dotfiles apply` to converge them. See [setup](docs/setup.md) and [recovery](docs/recovery.md).

## Daily use

The repository's `home/` directory is chezmoi's desired state. `dotfiles apply` renders it into regular files under `$HOME`; there are no dotfile symlinks.

Edit a registered live file, preview the capture, then publish it:

```sh
$EDITOR ~/.zshrc
dotfiles sync --dry-run
dotfiles sync
```

Only targets registered in `config/sync-policy.json` are captured. Templates and repository implementation are edited through `dotfiles edit` and normal Git, then applied with:

```sh
dotfiles apply --dry-run
dotfiles apply
```

To receive state published by another machine without publishing local HOME state:

```sh
git -C ~/.dotfiles pull --ff-only
dotfiles apply --dry-run
dotfiles apply
```

Preview or run environment updates:

```sh
dotfiles update --dry-run
dotfiles update
dotfiles update --select homebrew,bun-globals --skip mas-apps
```

Selections persist per machine. `--no-push` keeps a validated commit local. System updates and greedy Homebrew cask updates remain explicit opt-ins.

## Lifecycle commands

- `dotfiles setup` — install/reconfigure selected machine subsystems.
- `dotfiles apply [--dry-run]` — converge managed HOME state.
- `dotfiles sync [--dry-run] [--no-push]` — capture, merge, validate and publish managed state.
- `dotfiles update [--dry-run] [--no-push]` — update selected tools inside the same state transaction.
- `dotfiles edit` — open the repository in the configured editor.

See [synchronization](docs/sync.md) and [environment updates](docs/update.md). Public inventories are install-only: additions can install missing software on another matching machine; removals never uninstall anything.

All standalone utilities under `bin/` are extensionless strict TypeScript executables with `#!/usr/bin/env bun`. See the generated [utility command reference](docs/commands.md).

Machine-local overrides remain unmanaged in `~/.zshlocal`, `~/.gitlocal`, and `~/.config/dotfiles/local.json`. Secrets remain in Keychain or their owning applications.

Existing checkouts from before the chezmoi migration must run `dotfiles setup` before updating past the removal of `shell/`. That activation archives legacy HOME symlinks, replaces them with direct chezmoi-managed files, and records recovery metadata in the backup manifest.

The scripts under `setup/` are deprecated compatibility references. The typed setup CLI is authoritative; do not use legacy scripts for new-machine provisioning.
