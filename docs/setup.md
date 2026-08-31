# Setup

## Bootstrap contract

`install.sh` is the sole pre-Bun entry point. It rejects root, unsupported operating systems/architectures, and non-TTY interactive runs before network or filesystem mutation. `--non-interactive` is required for CI and headless servers.

An absent `~/.dotfiles` is cloned from `https://github.com/semencov/dotfiles.git`. An existing checkout is preserved only when it is the repository root with that exact origin; dirty state is never reset, cleaned, stashed, or overwritten. Unrelated/corrupt paths are moved to the private bootstrap backup root before clone.

Supported bootstrap flags:

```text
--non-interactive
--select <id[,id...]>
--skip <id[,id...]>
--dry-run
```

`--select` and `--skip` may repeat. Stage 1 task IDs are `core-tools`, `homebrew-packages`, `shell`, and `git`. Dependencies are resolved automatically. `--dry-run` completes selection and all preflights, then stops before backups or mutation.

## Commands

After the managed shell state is active, `~/.dotfiles/bin` is on `PATH`:

```sh
dotfiles setup
dotfiles setup --non-interactive --select core-tools,git --skip homebrew-packages,shell
dotfiles setup --dry-run
dotfiles apply --dry-run
dotfiles apply
dotfiles edit
```

`setup` loads the last successful selection from `~/.config/chezmoi/chezmoi.json`, shows the resolved plan, runs a full preflight barrier, archives conflicts, applies tasks in dependency order, applies chezmoi, verifies convergence, then atomically saves the new selection.

`apply` validates source state/templates, shows the pending diff, archives conflicting targets, forces the already-backed-up convergence, and requires an empty post-apply diff. `edit` chooses `$GUI_EDITOR`, `$VISUAL`, `$EDITOR`, then `code`, and launches it without a shell.

Homebrew reconciliation is install-only: `brew bundle check` followed, only when required, by `brew bundle install --no-upgrade`. Linux elevation is scoped to individual APT prerequisite commands. A Linux login-shell change has a separate confirmation and is never performed by a noninteractive dry-run.

## Machine-local state

`~/.config/chezmoi/chezmoi.json` is generated with mode `0600`. It stores the source directory, platform, successful task selection, strict template options, and chezmoi Git automation. Do not hand-edit it while setup is running.

Non-secret local overrides belong in the unmanaged `~/.config/dotfiles/local.json`; the managed `local.example.json` documents the shape. Shell- and Git-specific machine overrides remain unmanaged in `~/.zshlocal` and `~/.gitlocal`. Secrets remain in macOS Keychain or their owning application and must not enter Git or either JSON file.

The repository stays on HTTPS. When GitHub CLI authentication is absent, setup reports the explicit remediation:

```sh
gh auth login
gh auth setup-git
```

It does not generate, replace, or migrate SSH keys.

## Reruns and diagnostics

Setup and apply determine work from observed state; there are no successful-step markers. Interrupted runs can be rerun directly. A converged rerun performs validation but creates no managed-file backup and applies no chezmoi diff.

Durable JSONL logs are written under `~/.local/state/dotfiles/logs/`. Sensitive argument positions and secret-shaped environment/log fields are redacted. Conflict archives are under `~/.local/state/dotfiles/backups/<timestamp>/`; see [recovery](recovery.md).

The scripts under `setup/` are deprecated, macOS-heavy compatibility references. They are intentionally retained for later audited migration, but are not part of the supported bootstrap path.
