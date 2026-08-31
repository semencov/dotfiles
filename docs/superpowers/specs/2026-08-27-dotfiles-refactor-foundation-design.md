# Dotfiles Refactor: Foundation Design

Date: 2026-08-27

Status: Approved

## Context

This repository serves three purposes:

1. Provision a new macOS workstation or Ubuntu/Debian development server from one command.
2. Keep the resulting environment synchronized through a public Git repository.
3. Provide stable daily-use utilities.

The current implementation mixes a macOS-specific Bash installer, legacy setup scripts, Python symlink deployment, Mackup/iCloud state, and Bash, Zsh, Node, zx, and Bun utilities. Platform checks occur too late, configuration ownership overlaps, conflict handling is destructive, and most setup behavior is not verifiable or idempotent.

The refactor is divided into separately releasable stages. This document specifies Stage 1: the installation, configuration-management, and daily-lifecycle foundation. It also establishes the mandatory contract for the unified HOME-state migration in Stage 2.

## Goals

Stage 1 will:

- Make the published `install.sh` entry point work on current macOS and Ubuntu/Debian systems.
- Keep `~/.dotfiles` as the Git working tree.
- Use chezmoi as the desired-state engine for files under the user's home directory.
- Use Bun and strict TypeScript for interactive setup orchestration.
- Provide one core `dotfiles` CLI for setup, apply, sync, update, audit, diagnostics, and backup management.
- Deploy regular managed files rather than home-directory symlinks.
- Migrate the repository's current `shell/*` configuration and Brew manifest to chezmoi.
- Preserve existing utility command names and availability except the explicitly approved `dotfiles` alias and legacy update-command replacements.
- Back up conflicting files before the first apply.
- Make interrupted or failed installation safely rerunnable.
- Validate the supported platforms in CI.
- Produce a complete migration ledger covering Mackup and other useful HOME configuration for Stage 2.

## Non-goals

Stage 1 will not:

- Migrate unrelated `bin/*` implementations to TypeScript. That is Stage 3.
- Import audited HOME application data or remove Mackup. That is the mandatory Stage 2 gate.
- Preserve every historical macOS preference or SSD tweak. Their replacement is Stage 4.
- Support Linux distributions other than Ubuntu and Debian.
- Pin system packages to exact versions.
- Provide transactional rollback for package installation or operating-system changes.

## Architectural decision

Chezmoi is the configuration state engine. Bun is the imperative setup engine.

Chezmoi owns only the desired state of files and directories under `$HOME`: regular files, templates, permissions, platform selection, and secret references. Git remains storage and transport. Chezmoi uses the checkout at `~/.dotfiles` and is configured to auto-commit and auto-push source changes.

The Bun setup CLI owns prompts, task dependency resolution, package installation, operating-system commands, preflight checks, verification, logs, and summaries. Setup tasks may invoke chezmoi through its public CLI, but no task reimplements chezmoi's state calculation. Chezmoi scripts remain thin adapters and do not contain machine-provisioning logic.

`install.sh` is the only permanent pre-runtime shell exception. It bootstraps enough tooling to start the TypeScript setup CLI. Daily utilities will eventually be TypeScript executables with Bun shebangs, but that migration is outside Stage 1 except for the core `dotfiles` lifecycle CLI.

Chezmoi's Git auto-commit and auto-push remain enabled. Repository-local Git hooks enforce the validation boundary before either operation can publish source-state changes.

## Repository layout

The target top-level layout is:

```text
install.sh                  portable pre-Bun bootstrap
.chezmoiroot                selects home/ as chezmoi source state
home/                       chezmoi files, templates, and metadata
src/cli/                    core dotfiles command surface
src/setup/                  setup task graph and platform tasks
src/lib/                    shared process, filesystem, logging, and OS adapters
bin/dotfiles                Bun entry point for the core CLI
bin/                        remaining stable utility entry points
tests/                      unit, contract, integration, and fixtures
docs/                       design, migration, operations, and recovery docs
.githooks/                  versioned commit/push safety gates
```

The source-state naming conventions inside `home/` follow chezmoi attributes. Files outside `home/` are normal repository files and are not candidates for deployment into `$HOME`.

## Installation flow

The documented entry point remains:

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/semencov/dotfiles/HEAD/install.sh)"
```

`HEAD` is the sole documented bootstrap URL. The bootstrap trusts HTTPS downloads from official chezmoi and Bun endpoints and delegates artifact validation to their upstream installers; it does not add a second checksum/signature mechanism.

The bootstrap performs only these responsibilities:

1. Require an interactive terminal for the standard installation flow.
2. Detect the operating system and architecture.
3. Reject unsupported platforms before mutation.
4. Validate basic network and filesystem prerequisites.
5. Install current stable chezmoi and Bun in user-writable locations.
6. Initialize or validate the public repository at `~/.dotfiles`.
7. Launch the Bun setup CLI.

Interactive mode is the default. Non-interactive mode uses defaults or saved selections and accepts explicit `--select` and `--skip` overrides for CI and headless servers.

The bootstrap must not install the complete toolchain, modify operating-system preferences, deploy dotfiles, or run as root. It may elevate an individual prerequisite command only when the selected platform requires it.

Repository initialization follows these rules:

- If `~/.dotfiles` is absent, initialize it from the public HTTPS remote.
- If it is a valid checkout of the expected repository, preserve it, including dirty changes.
- If it is unrelated or corrupt, move it into the installation backup before initializing.
- Never reset, clean, overwrite, or silently stash user changes.

The repository remains on HTTPS. Setup uses `gh auth login` and `gh auth setup-git` when push authentication is required; it does not depend on registering a newly generated SSH key.

## Setup task model

Each task declares:

- A stable identifier and display name.
- Supported operating systems.
- Dependencies on other tasks.
- Whether it is selected by default.
- Its risk and privilege requirements.
- Preflight, apply, and verify operations.

Tasks determine completion from current machine state. A successful-step marker is never authoritative. This makes rerunning after interruption equivalent to requesting convergence again.

The wizard uses these subsystem groups as tasks are introduced across the refactor:

- Core tools.
- Homebrew packages and Linux system prerequisites.
- Shell and terminal configuration.
- Git configuration.
- Development runtimes.
- GUI applications on macOS.
- System preferences on macOS.
- Server configuration on Ubuntu/Debian.
- Application settings.

Stage 1 displays only groups backed by implemented tasks; it does not expose placeholder choices for later stages. Dependencies are selected automatically and explained. The resolved execution plan is shown before mutation. Subsequent runs load the previous machine-local choices and allow the user to change them.

Machine-specific setup data is stored in `~/.config/chezmoi/chezmoi.json`. It includes the source directory, detected platform, selected features, non-secret template values, and Git auto-commit/auto-push configuration. Secret values are not written to this file.

Non-secret private or work-specific template values live in the unmanaged `~/.config/dotfiles/local.json`. Public defaults remain in the repository. Secret values remain in macOS Keychain and are never copied into either data file.

## Execution lifecycle

One setup run follows this lifecycle:

```text
detect
  -> prompt
  -> resolve task dependencies
  -> show plan
  -> preflight every selected task
  -> back up conflicting managed targets
  -> apply tasks in dependency order
  -> chezmoi apply
  -> verify every selected task
  -> print summary
```

All selected preflight operations finish before the first mutation. A failed task stops execution to prevent dependency cascades. A rerun recalculates the full plan and current state, then performs only missing work.

The installer runs as the current user. It requests `sudo` only for individual commands that require elevated privileges. It does not keep a hidden privilege-refresh loop and never runs the Bun process or chezmoi wholesale as root. On Ubuntu/Debian, changing the login shell to Homebrew Zsh is an explicit wizard choice and confirmation, not an unconditional mutation.

## Conflict backup and recovery

Before the first chezmoi apply, conflicting targets are moved to:

```text
~/.local/state/dotfiles/backups/<timestamp>/
```

The backup root and each archive are private `0700` directories. The archive preserves paths relative to `$HOME` and contains a machine-readable manifest with the original path, target type, permissions, backup path, and migration reason. Existing symlinks created by `sync.py` are included in the manifest before replacement with regular files.

Chezmoi provides atomic target-file updates. Package installation and operating-system mutation are not automatically rolled back. Recovery consists of fixing the reported cause and rerunning setup. Documentation will include manual restoration from the conflict archive. Backups are never deleted automatically; `dotfiles backups list` and `dotfiles backups prune` provide explicit inspection and deletion.

Temporary files are removed on normal exit, error, and handled interruption. Durable logs are stored in:

```text
~/.local/state/dotfiles/logs/<timestamp>.log
```

Errors report the task, sanitized command, exit status, log path, and a concrete remediation. Commands and environment values are redacted before logging when they can contain secrets.

## Chezmoi configuration behavior

Chezmoi uses:

- `sourceDir` set to `~/.dotfiles`.
- File mode, not symlink mode.
- A `.chezmoiroot` file pointing to `home/`.
- Platform templates limited to macOS and Linux branches needed by Ubuntu/Debian.
- `git.autoCommit` and `git.autoPush` enabled.
- Strict missing-template-key behavior.
- Repository-local `core.hooksPath` pointing to `.githooks/`.

Failure to auto-push does not invalidate a successful local apply. It produces a warning and remediation because initial HTTPS checkout can succeed before GitHub push authentication is configured.

Before every auto-commit and auto-push, hooks enforce the managed-path allowlist, secret scanning, file-size/type limits, template validation, and rejection of unknown paths or suspicious values. CI repeats these controls as defense in depth, but CI is never the first secret boundary because the repository is public.

The user's local machine data remains outside Git. On macOS, private operations retrieve secrets through chezmoi's native Keychain-backed `keyring` function. Ubuntu/Debian secrets remain local-only unless a later design explicitly changes that policy.

## Configuration migration

Stage 1 migrates every file currently deployed by `sync.py` from `shell/` into `home/`. The Brew manifest becomes a single chezmoi-managed source rather than overlapping repository and Mackup copies.

The existing `~/.config/chezmoi/chezmoi.toml` and state database are backed up before the new JSON configuration is installed. Its current auto-commit/auto-push intent is preserved; stale default-source state under `~/.local/share/chezmoi` is reported and left untouched until explicit backup pruning.

The current `.gitlocal` name/email become public defaults in the managed Git configuration; this information is already public in commit metadata. An unmanaged `.gitlocal` remains an optional override hook.

The current `.zshlocal` is split by responsibility. Its five tokens are removed from global shell exports and accessed on demand inside the commands that need them through Keychain. Its remaining non-secret project paths, work identity, PATH customization, and Lando socket behavior stay in the unmanaged `.zshlocal`. Setup preserves this file rather than replacing it with an empty template.

To protect existing machines during rollout, legacy `shell/*` paths remain as repository symlinks to their corresponding `home/` source files for one migration cycle. Existing `$HOME` symlinks therefore continue resolving immediately after a Git pull. The first successful chezmoi apply backs up and replaces them with regular files.

`sync.py` is removed only after all of its targets exist in chezmoi and migration tests pass. Existing `setup/*` scripts remain available but are marked deprecated; Stage 4 removes them only after equivalent tasks exist and an explicit deletion report is approved.

The `bin/` directory stays on `PATH`, so unrelated utility command names and behavior remain unchanged during Stage 1. The current `dotfiles` editor alias is replaced by the core CLI; `dotfiles edit` preserves its editor-opening behavior. The duplicate legacy `bin/update` and `bin/update.mjs` commands are explicitly removed when `dotfiles update` lands rather than retained as compatibility wrappers.

## Core CLI

Stage 1 introduces these commands:

- `dotfiles setup`: run or reconfigure the interactive setup task graph.
- `dotfiles apply`: validate and apply chezmoi source state.
- `dotfiles sync`: import allowlisted live-file changes, snapshot installed inventories, validate, auto-commit, and auto-push.
- `dotfiles update`: orchestrate remote convergence, tool updates, final state capture, validation, commit, and push.
- `dotfiles audit`: report unmanaged HOME candidates, drift, unsafe paths, and inventory changes without auto-adding unknown paths.
- `dotfiles doctor`: run platform, dependency, template, Git, Keychain, and configuration diagnostics.
- `dotfiles edit`: open `~/.dotfiles` with the configured GUI editor.
- `dotfiles backups list|restore|prune`: inspect and explicitly operate on private migration archives.

`dotfiles sync` imports changes only from an explicit allowlist of non-template targets using chezmoi's re-add behavior. Templates remain source-edited. Every mutable app-owned target requires a normalizer that enforces its approved field policy, typically removing machine identifiers, timestamps, caches, volatile fields, and private source names. Unknown schema changes block sync pending review.

During a sync batch, chezmoi's automatic Git actions are suppressed with an invocation-local configuration. The CLI imports and normalizes the complete batch, validates it, then performs one commit and push. Chezmoi auto-commit/auto-push remains active for direct day-to-day chezmoi commands, protected by the same hooks.

Sync uses last-sync-wins semantics by explicit decision. It snapshots the initiating machine's allowlisted live state, pulls remote history, reapplies that local snapshot over content conflicts, commits normally, and pushes without rewriting Git history. The remote version remains recoverable from Git and the local version from the conflict archive, but a stale machine syncing later can intentionally replace newer content.

`dotfiles update` uses the existing `smcv-cli` update target inventory and interaction model only as design input; it does not depend on, modify, wrap, or copy that repository's implementation. It runs dependency-aware groups sequentially, continues independent groups after failure, and exits non-zero with a complete summary if any selected group fails.

The update lifecycle is:

```text
snapshot allowlisted live state
  -> pull remote source
  -> resolve source/live conflicts with local snapshot winning
  -> chezmoi apply
  -> run selected package/tool updates
  -> snapshot installed inventories
  -> re-import normalized live configuration
  -> validate through Git hooks
  -> auto-commit and auto-push
```

Normal selected update targets include Homebrew formulae/casks, Bun globals, global AI skills/plugins, uv-managed tools, editor extensions, GitHub CLI extensions, Mac App Store apps, and dotfile/config convergence. Greedy Homebrew cask upgrades are separate opt-in targets. macOS or Ubuntu operating-system updates are available but unselected by default. The command never upgrades system Python with `--break-system-packages`.

Setup installs missing requirements without upgrading unrelated packages. Broad upgrades belong exclusively to `dotfiles update`.

## Unified HOME-state migration contract

Stage 1 inventories the actual Mackup storage, top-level HOME files, `~/.config/*`, and known high-value paths under `~/Library/Application Support` and `~/Library/Preferences` for selected installed applications. It does not crawl or version the entire Library tree. The result is one versioned ledger for Stage 2.

Every configured or discovered target must have exactly one classification:

1. `git`: stable, user-authored configuration managed directly by chezmoi.
2. `keychain`: private content referenced or retrieved on demand from macOS Keychain without entering Git.
3. `regenerate`: vendor, package, or application state reproduced by setup rather than versioned.
4. `exclude`: volatile or machine-specific state deliberately unmanaged, with a written rationale.

The ledger records source path, destination path, application owner, sensitivity, format, platform, classification, migration action, normalizer, and verification method. Duplicate/conflicted iCloud files are separate entries until explicitly resolved. The current live application file is canonical; alternates are archived with a diff report. No target may remain unclassified.

Stage 2 must execute the unified ledger, verify all managed destinations, run Mackup's uninstall operation, and retain the iCloud Mackup directory as rollback material before removing Mackup or `.mackup.cfg`. Affected applications must be closed by the user before their files migrate; setup stops with instructions and never force-quits them. This is a mandatory gate before the utility migration begins.

Examples requiring private or non-Git handling include SSH private keys, `.netrc`, AWS credentials, and application authentication files. Examples requiring volatile-state review include `known_hosts`, application update preferences, plugin counters/caches, and iCloud conflict copies. Secret contents must never enter the public repository, test fixtures, logs, inventories, or migration reports.

Tool-native login or SSO is authoritative for Codex, Claude, Pi, Composer, GitHub CLI, AWS, and other volatile OAuth/session formats. Keychain is used only for stable raw tokens that commands must retrieve on demand. Moving existing plaintext tokens into Keychain does not trigger automatic revocation or a mandatory rotation workflow.

Existing SSH keys on this machine are preserved untouched and backed up before SSH configuration changes. New machines generate unique local private keys. Chezmoi manages SSH configuration, public metadata, and generation workflow, but never syncs private keys. For GPG, chezmoi manages configuration plus public-key and ownertrust exports while preserving local keyrings and never syncing private keys.

Histories, transcripts, conversations, sessions, telemetry, logs, caches, recent-project lists, locks, databases, automatic backups, and generated machine identity are excluded. This includes shell histories, AI chat/session stores, editor conversation/embedding stores, Micro backup buffers, Storybook onboarding state, and Zed temporary files.

Global AI-tool preferences, instructions, MCP declarations, and public plugin manifests are candidates for Git. Absolute project paths, project trust decisions, memories, private marketplace names/URLs, authentication, downloaded plugins, and runtime state are excluded or sourced from local data. Editor settings, keybindings, snippets, and extension manifests are candidates; installed extensions, workspaces, indexes, and storage are regenerated or excluded.

OpenLogi's complete canonical `config.toml`, including device IDs and application-owned fields, is managed as an approved normalizer exception. Its normalizer validates the schema but preserves those fields. Lock files and automatic backups remain excluded. CHIRP state, including `chirp.config` and radio images, is entirely excluded.

macOS application plist files are not copied wholesale. Intentional supported keys become reversible setup tasks; updater state, caches, and full preference dumps are excluded.

Initial high-value candidates outside the current Mackup set include global `~/CLAUDE.md` and `~/biome.json`; authored Claude/Codex/Gemini/Copilot/OpenCode/Pi instructions and global settings; Docker daemon settings; `.config` settings for Ghostty, Git, htop, Midnight Commander, Micro, Yazi, Zed, AI Completion, mactop, and OpenLogi; and editor/skill/plugin manifests. The ledger, not this illustrative list, is authoritative.

New files are never auto-added. `dotfiles audit` reports future candidates, and adding a source path requires explicit approval.

## Package policy

System packages track current stable releases. Homebrew is the primary package manager on both macOS and Ubuntu/Debian. One Brewfile uses explicit platform sections; APT installs only Linux bootstrap and system prerequisites. Bun dependencies remain locked in `bun.lock`. Package manifests are declarative inputs to setup tasks; TypeScript contains orchestration and validation rather than duplicating manifest contents.

Native standalone CLIs use Homebrew. npm-only global CLIs use `bun add --global`. Node/fnm remains for project compatibility, while global npm/pnpm prefixes are retired where feasible.

Successful setup and update runs automatically snapshot installed Homebrew packages/casks, Bun globals, uv tools, Mac App Store applications, editor extensions, AI skills/plugins, and other supported add-ons. No shell-login hook or background daemon performs snapshots. Snapshots include only approved public sources; private taps, internal extensions, private MCP servers, and company package names remain local. Git hooks validate snapshots before auto-commit/push.

Inventories are install-only desired state. Additions propagate to other matching platforms. Removing an inventory entry never uninstalls software automatically; removals require an explicit reviewed cleanup command.

Stage 1 installs only the packages required for the foundation and the currently declared default environment. Legacy or questionable packages are retained unless their removal is required for correctness. Broader package pruning belongs to Stage 4 and requires an explicit deletion/replacement list.

## Verification strategy

The TypeScript design injects filesystem, environment, process, prompt, and privilege adapters so behavior can be tested without mutating the developer machine.

Tests include:

- Unit tests for platform detection, task graph resolution, saved selection, command construction, redaction, backup paths, and error formatting.
- Unit tests for CLI command routing, update dependency groups, last-sync-wins resolution, normalizers, inventory filtering, and cleanup planning.
- Contract tests for each task's preflight, apply, and verify behavior using controlled adapters.
- Integration tests using a temporary `HOME` and real chezmoi apply/diff behavior.
- Integration tests for repository-local commit/push hooks, including intentionally seeded token/private-key fixtures that must be rejected before commit.
- Failure injection proving that an interrupted run converges on rerun.
- A second-run idempotency test.
- Strict TypeScript checks.
- ShellCheck for `install.sh`.
- Syntax validation for Zsh, Git configuration, chezmoi templates, and supported package manifests.
- Security fixtures proving secrets do not appear in logs or Git candidates.

GitHub Actions runs on Ubuntu and macOS. Ubuntu performs a safe core installation inside an isolated home directory and repeats it. macOS performs the same core test while keeping system-preference and GUI tasks in dry-run mode. Pull-request CI invokes the checked-out installer directly; the public `HEAD` one-liner is tested separately against the published default branch. Full package and operating-system mutation is excluded from per-commit CI; a scheduled or manually dispatched workflow exercises broader package-install smoke tests.

## Acceptance criteria

Stage 1 is complete when:

- The public one-line command reaches the interactive wizard on clean supported macOS and Ubuntu/Debian systems.
- Unsupported platforms fail before mutation.
- Every default-selected task has preflight and verification behavior.
- Existing managed files and unrelated `~/.dotfiles` directories are preserved in a manifested backup.
- A forced mid-run failure followed by a rerun converges successfully.
- A second successful run produces no unintended changes.
- Current `shell/*` targets are regular chezmoi-managed files in `$HOME`.
- The core `dotfiles` CLI exposes `setup`, `apply`, `sync`, `update`, `audit`, `doctor`, `edit`, and backup operations.
- The previous `dotfiles` editor behavior remains available as `dotfiles edit`.
- Legacy `bin/update` and `bin/update.mjs` are removed; unrelated utility commands remain available with unchanged interfaces.
- Auto-commit/auto-push cannot bypass local allowlist, secret, type, size, and schema checks.
- Live allowlisted config changes round-trip through sync with documented last-sync-wins behavior.
- Installed public package/add-on inventories are captured without causing automatic removals.
- CI passes on macOS and Ubuntu.
- The unified HOME ledger contains every discovered Mackup and audited HOME target with no unclassified entries.
- No secret content is committed or logged.

## Follow-on stages

After Stage 1 is implemented and verified:

1. Stage 2 executes the unified HOME ledger, migrates Mackup and other approved HOME state, verifies results, archives rollback data, and removes Mackup.
2. Stage 3 migrates retained utilities to Bun/TypeScript while preserving command contracts and removing obsolete commands from an approved deletion list.
3. Stage 4 replaces legacy setup scripts, rebuilds a small current and reversible macOS preference set, completes Ubuntu provisioning, audits packages/configuration, and removes migration compatibility paths.

Each follow-on stage receives its own design, review, implementation plan, and verification gate.

## References

- [Chezmoi configuration file](https://www.chezmoi.io/reference/configuration-file/)
- [Chezmoi source-state attributes](https://www.chezmoi.io/reference/source-state-attributes/)
- [Chezmoi script lifecycle](https://www.chezmoi.io/user-guide/use-scripts-to-perform-actions/)
- [Chezmoi Keychain integration](https://www.chezmoi.io/user-guide/password-managers/keychain-and-windows-credentials-manager/)
- [Mackup configuration and storage](https://github.com/lra/mackup/blob/master/doc/README.md)
