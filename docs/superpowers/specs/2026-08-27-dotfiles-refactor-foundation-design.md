# Dotfiles Refactor: Foundation Design

Date: 2026-08-27

Status: Approved in chat; awaiting written-spec review

## Context

This repository serves three purposes:

1. Provision a new macOS workstation or Ubuntu/Debian development server from one command.
2. Keep the resulting environment synchronized through a public Git repository.
3. Provide stable daily-use utilities.

The current implementation mixes a macOS-specific Bash installer, legacy setup scripts, Python symlink deployment, Mackup/iCloud state, and Bash, Zsh, Node, zx, and Bun utilities. Platform checks occur too late, configuration ownership overlaps, conflict handling is destructive, and most setup behavior is not verifiable or idempotent.

The refactor is divided into separately releasable stages. This document specifies Stage 1: the installation and configuration-management foundation. It also establishes the mandatory contract for the Mackup evacuation in Stage 2.

## Goals

Stage 1 will:

- Make the published `install.sh` entry point work on current macOS and Ubuntu/Debian systems.
- Keep `~/.dotfiles` as the Git working tree.
- Use chezmoi as the desired-state engine for files under the user's home directory.
- Use Bun and strict TypeScript for interactive setup orchestration.
- Deploy regular managed files rather than home-directory symlinks.
- Migrate the repository's current `shell/*` configuration and Brew manifest to chezmoi.
- Preserve existing utility command names and availability.
- Back up conflicting files before the first apply.
- Make interrupted or failed installation safely rerunnable.
- Validate the supported platforms in CI.
- Produce a complete Mackup migration ledger for Stage 2.

## Non-goals

Stage 1 will not:

- Migrate `bin/*` implementations to TypeScript. That is Stage 3.
- Import Mackup-managed application data or remove Mackup. That is the mandatory Stage 2 gate.
- Preserve every historical macOS preference or SSD tweak. Their replacement is Stage 4.
- Support Linux distributions other than Ubuntu and Debian.
- Pin system packages to exact versions.
- Provide transactional rollback for package installation or operating-system changes.

## Architectural decision

Chezmoi is the configuration state engine. Bun is the imperative setup engine.

Chezmoi owns only the desired state of files and directories under `$HOME`: regular files, templates, permissions, platform selection, and secret references. Git remains storage and transport. Chezmoi uses the checkout at `~/.dotfiles` and is configured to auto-commit and auto-push source changes.

The Bun setup CLI owns prompts, task dependency resolution, package installation, operating-system commands, preflight checks, verification, logs, and summaries. Setup tasks may invoke chezmoi through its public CLI, but no task reimplements chezmoi's state calculation. Chezmoi scripts remain thin adapters and do not contain machine-provisioning logic.

`install.sh` is the only permanent pre-runtime shell exception. It bootstraps enough tooling to start the TypeScript setup CLI. Daily utilities will eventually be TypeScript executables with Bun shebangs, but that migration is outside Stage 1.

## Repository layout

The target top-level layout is:

```text
install.sh                  portable pre-Bun bootstrap
.chezmoiroot                selects home/ as chezmoi source state
home/                       chezmoi files, templates, and metadata
src/setup/                  setup CLI, task graph, and platform tasks
src/lib/                    shared process, filesystem, logging, and OS adapters
bin/                        stable utility entry points
tests/                      unit, contract, integration, and fixtures
docs/                       design, migration, operations, and recovery docs
```

The source-state naming conventions inside `home/` follow chezmoi attributes. Files outside `home/` are normal repository files and are not candidates for deployment into `$HOME`.

## Installation flow

The documented entry point remains:

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/semencov/dotfiles/HEAD/install.sh)"
```

The bootstrap performs only these responsibilities:

1. Require an interactive terminal for the standard installation flow.
2. Detect the operating system and architecture.
3. Reject unsupported platforms before mutation.
4. Validate basic network and filesystem prerequisites.
5. Install current stable chezmoi and Bun in user-writable locations.
6. Initialize or validate the public repository at `~/.dotfiles`.
7. Launch the Bun setup CLI.

The bootstrap must not install the complete toolchain, modify operating-system preferences, deploy dotfiles, or run as root. It may elevate an individual prerequisite command only when the selected platform requires it.

Repository initialization follows these rules:

- If `~/.dotfiles` is absent, initialize it from the public HTTPS remote.
- If it is a valid checkout of the expected repository, preserve it, including dirty changes.
- If it is unrelated or corrupt, move it into the installation backup before initializing.
- Never reset, clean, overwrite, or silently stash user changes.

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
- Homebrew or APT packages.
- Shell and terminal configuration.
- Git configuration.
- Development runtimes.
- GUI applications on macOS.
- System preferences on macOS.
- Server configuration on Ubuntu/Debian.
- Application settings.

Stage 1 displays only groups backed by implemented tasks; it does not expose placeholder choices for later stages. Dependencies are selected automatically and explained. The resolved execution plan is shown before mutation. Subsequent runs load the previous machine-local choices and allow the user to change them.

Machine-specific setup data is stored in `~/.config/chezmoi/chezmoi.json`. It includes the source directory, detected platform, selected features, non-secret template values, and Git auto-commit/auto-push configuration. Secret values are not written to this file.

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

The installer runs as the current user. It requests `sudo` only for individual commands that require elevated privileges. It does not keep a hidden privilege-refresh loop and never runs the Bun process or chezmoi wholesale as root.

## Conflict backup and recovery

Before the first chezmoi apply, conflicting targets are moved to:

```text
~/.local/state/dotfiles/backups/<timestamp>/
```

The archive preserves paths relative to `$HOME` and contains a machine-readable manifest with the original path, target type, permissions, backup path, and migration reason. Existing symlinks created by `sync.py` are included in the manifest before replacement with regular files.

Chezmoi provides atomic target-file updates. Package installation and operating-system mutation are not automatically rolled back. Recovery consists of fixing the reported cause and rerunning setup. Documentation will include manual restoration from the conflict archive.

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

Failure to auto-push does not invalidate a successful local apply. It produces a warning and remediation because initial HTTPS checkout can succeed before GitHub push authentication is configured.

The user's local machine data remains outside Git. On macOS, future private templates retrieve secrets through chezmoi's native Keychain-backed `keyring` function. Ubuntu/Debian secrets remain local-only unless a later design explicitly changes that policy.

## Configuration migration

Stage 1 migrates every file currently deployed by `sync.py` from `shell/` into `home/`. The Brew manifest becomes a single chezmoi-managed source rather than overlapping repository and Mackup copies.

To protect existing machines during rollout, legacy `shell/*` paths remain as repository symlinks to their corresponding `home/` source files for one migration cycle. Existing `$HOME` symlinks therefore continue resolving immediately after a Git pull. The first successful chezmoi apply backs up and replaces them with regular files.

`sync.py` is removed only after all of its targets exist in chezmoi and migration tests pass. Existing `setup/*` scripts remain available but are marked deprecated; Stage 4 removes them only after equivalent tasks exist and an explicit deletion report is approved.

The `bin/` directory stays on `PATH`, so utility command names and behavior remain unchanged during Stage 1.

## Mackup migration contract

Stage 1 inventories the actual Mackup storage and emits a versioned ledger. Every configured or discovered target must have exactly one classification:

1. `git`: stable, user-authored configuration managed directly by chezmoi.
2. `keychain`: private content generated by a chezmoi template from macOS Keychain.
3. `regenerate`: vendor, package, or application state reproduced by setup rather than versioned.
4. `exclude`: volatile or machine-specific state deliberately unmanaged, with a written rationale.

The ledger records source path, destination path, application owner, sensitivity, format, platform, classification, migration action, and verification method. Duplicate/conflicted iCloud files are separate entries until explicitly resolved. No target may remain unclassified.

Stage 2 must complete the ledger, verify all managed destinations, run Mackup's uninstall operation, and retain the iCloud Mackup directory as rollback material before removing Mackup or `.mackup.cfg`. This is a mandatory gate before the utility migration begins.

Examples requiring private or non-Git handling include SSH private keys, `.netrc`, AWS credentials, and application authentication files. Examples requiring volatile-state review include `known_hosts`, GPG trust databases, application update preferences, plugin counters/caches, and iCloud conflict copies. Secret contents must never enter the public repository, test fixtures, logs, or migration reports.

## Package policy

System packages track current stable releases from Homebrew or Ubuntu/Debian repositories. Bun dependencies remain locked in `bun.lock`. Package manifests are declarative inputs to setup tasks; TypeScript contains orchestration and validation rather than duplicating manifest contents.

Stage 1 installs only the packages required for the foundation and the currently declared default environment. Legacy or questionable packages are retained unless their removal is required for correctness. Broader package pruning belongs to Stage 4 and requires an explicit deletion/replacement list.

## Verification strategy

The TypeScript design injects filesystem, environment, process, prompt, and privilege adapters so behavior can be tested without mutating the developer machine.

Tests include:

- Unit tests for platform detection, task graph resolution, saved selection, command construction, redaction, backup paths, and error formatting.
- Contract tests for each task's preflight, apply, and verify behavior using controlled adapters.
- Integration tests using a temporary `HOME` and real chezmoi apply/diff behavior.
- Failure injection proving that an interrupted run converges on rerun.
- A second-run idempotency test.
- Strict TypeScript checks.
- ShellCheck for `install.sh`.
- Syntax validation for Zsh, Git configuration, chezmoi templates, and supported package manifests.
- Security fixtures proving secrets do not appear in logs or Git candidates.

GitHub Actions runs on Ubuntu and macOS. Ubuntu performs a safe core installation inside an isolated home directory and repeats it. macOS performs the same core test while keeping system-preference and GUI tasks in dry-run mode. Full package and operating-system mutation is excluded from per-commit CI; a scheduled or manually dispatched workflow exercises broader package-install smoke tests.

## Acceptance criteria

Stage 1 is complete when:

- The public one-line command reaches the interactive wizard on clean supported macOS and Ubuntu/Debian systems.
- Unsupported platforms fail before mutation.
- Every default-selected task has preflight and verification behavior.
- Existing managed files and unrelated `~/.dotfiles` directories are preserved in a manifested backup.
- A forced mid-run failure followed by a rerun converges successfully.
- A second successful run produces no unintended changes.
- Current `shell/*` targets are regular chezmoi-managed files in `$HOME`.
- Existing utility commands remain available with unchanged interfaces.
- CI passes on macOS and Ubuntu.
- The Mackup ledger contains every discovered target with no unclassified entries.
- No secret content is committed or logged.

## Follow-on stages

After Stage 1 is implemented and verified:

1. Stage 2 executes the Mackup ledger, verifies the migration, archives rollback data, and removes Mackup.
2. Stage 3 migrates retained utilities to Bun/TypeScript while preserving command contracts and removing obsolete commands from an approved deletion list.
3. Stage 4 replaces legacy setup scripts, rebuilds a small current and reversible macOS preference set, completes Ubuntu provisioning, audits packages/configuration, and removes migration compatibility paths.

Each follow-on stage receives its own design, review, implementation plan, and verification gate.

## References

- [Chezmoi configuration file](https://www.chezmoi.io/reference/configuration-file/)
- [Chezmoi source-state attributes](https://www.chezmoi.io/reference/source-state-attributes/)
- [Chezmoi script lifecycle](https://www.chezmoi.io/user-guide/use-scripts-to-perform-actions/)
- [Chezmoi Keychain integration](https://www.chezmoi.io/user-guide/password-managers/keychain-and-windows-credentials-manager/)
- [Mackup configuration and storage](https://github.com/lra/mackup/blob/master/doc/README.md)
