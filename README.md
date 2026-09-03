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

Existing checkouts from before the chezmoi migration must run `dotfiles setup` before updating past the removal of `shell/`. That activation archives legacy HOME symlinks, replaces them with direct chezmoi-managed files, and records recovery metadata in the backup manifest.

The scripts under `setup/` are deprecated compatibility references. The typed setup CLI is authoritative; do not use legacy scripts for new-machine provisioning.
