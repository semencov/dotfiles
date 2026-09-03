# Dotfiles Repository Cleanup Design

Date: 2026-09-02

Status: Approved

## Context

The Stage 1 foundation introduced a Bun/TypeScript lifecycle CLI and a chezmoi source under `home/`, but the repository and the current machine remain transitional. Live HOME paths still use the old `shell/` link chain, the default chezmoi source is stale, Mackup remains active, deprecated setup scripts remain tracked, and `bin/` still mixes shell, Node, zx, and Bun implementations. Documentation is split across many command-sized files and the CLI does not yet expose enough detail during dry runs.

Repository cleanup is therefore part of the migration, not a standalone deletion pass. Replacements must be activated and verified before their legacy inputs are removed. Clear duplicates and obsolete commands may be deleted without a per-file approval ceremony after reference, behavior, and recovery checks pass.

This design extends the foundation design. Where a prior plan preserves transitional files for a later stage, this design defines the conditions for retiring them.

## Goals

- Leave one authoritative implementation for every supported responsibility.
- Make `home/` the sole chezmoi source and remove live or repository compatibility links after verified migration.
- Account for every Mackup-managed target before retiring Mackup.
- Convert every retained executable under `bin/` to a strict TypeScript Bun executable using Bun Shell for process orchestration.
- Preserve stable daily command names unless a command is obsolete, duplicated, or explicitly superseded by the `dotfiles` lifecycle CLI.
- Replace deprecated setup scripts with dependency-aware setup tasks before deleting them.
- Consolidate command documentation and delete stale or redundant documents.
- Remove unused runtime dependencies, generated cruft, broken links, and dead repository structure.
- Keep each migration wave deployable, rerunnable, and recoverable.

## Non-goals

- Reimplement `install.sh` in Bun. It must remain the only pre-Bun Bash entry point.
- Convert Zsh configuration modules into TypeScript.
- Make inherently macOS-specific commands work on Linux. They must instead reject unsupported platforms early and clearly.
- Import secrets, private keys, application sessions, caches, or machine identity into Git.
- Preserve obsolete commands solely because they exist in repository history.
- Perform broad software uninstallation or operating-system cleanup.

## Target repository architecture

```text
install.sh                 pre-Bun bootstrap; the only permanent Bash program
bin/
  dotfiles                 environment lifecycle CLI
  <utility>                extensionless Bun/TypeScript executables
src/
  cli/                     lifecycle command routing
  setup/                   dependency-aware provisioning tasks
  utilities/               shared utility behavior
  lib/                     typed process, filesystem, platform, and logging primitives
home/                      sole chezmoi source
config/                    public policies and HOME-state ledger
inventories/               public install-only tool inventories
tests/                     source- and command-mirrored verification
docs/
  commands.md              consolidated utility reference
  setup.md                 installation and provisioning operations
  recovery.md              backup and interrupted-operation recovery
zsh/                       sourced shell configuration and plugins
```

The following transitional surfaces are removed only after their replacement gates pass:

```text
shell/
setup/*.sh
home/dot_mackup*
bin/*.mjs
bin/*.sh
scattered command-only documentation
unused package dependencies
```

`node_modules/`, `.DS_Store`, editor metadata, logs, worktrees, and other generated local artifacts remain untracked. Cleanup may remove such local artifacts when their targets are exact and recoverability is irrelevant, but their presence is not part of repository state.

## Migration waves

### Wave 1: activate the foundation

Run the supported setup path against the real machine before removing compatibility state. The first activation must:

1. Validate the expected HTTPS checkout and supported platform.
2. Archive the current managed HOME symlinks and any conflicting chezmoi configuration.
3. Create the private machine configuration at `~/.config/chezmoi/chezmoi.json`.
4. Apply `home/` as regular files.
5. Verify an empty post-apply diff and a no-op second apply.
6. Preserve the stale default source at `~/.local/share/chezmoi` until later migration verification.

The current two-hop links, such as `~/.zshrc -> ~/.dotfiles/shell/.zshrc -> ../home/dot_zshrc`, are compatibility state rather than the final topology. `shell/` cannot be removed until no live HOME target resolves through it.

### Wave 2: classify HOME and retire Mackup

Build a deterministic, versioned HOME-state ledger. The bounded scanner covers every Mackup application and custom definition, the approved top-level HOME paths, approved `.config` application roots, and an explicit macOS `Library` allowlist. Every candidate has exactly one classification:

- `git`: safe, stable, portable desired state managed by chezmoi.
- `keychain`: secret material represented only by a public service identifier.
- `regenerate`: derived state recreated by setup or the owning application.
- `exclude`: intentionally unmanaged state with a recorded rationale.

Unknown targets block Mackup retirement. Paths whose names are themselves private are represented through opaque local-policy identifiers; their real names never enter Git.

Stable public configuration moves into `home/`. Mutable configuration uses strict, target-specific normalizers before publication. `.zshlocal` and `.gitlocal` remain optional unmanaged overrides after safe public defaults are extracted. Existing SSH private keys and GPG private keyrings must have identical bytes or fingerprints before and after migration.

Mackup is retired only when:

- The ledger reports zero unclassified or duplicate targets.
- Every target verifies as `git`, `keychain`, `regenerate`, or `exclude`.
- No active HOME path remains a Mackup symlink.
- Two consecutive chezmoi applies are byte-stable.
- The iCloud Mackup directory remains intact as documented rollback material.

Only then are the tracked Mackup configuration and definitions removed. The stale default chezmoi source and `shell/` are removed only after equivalent no-reference checks.

### Wave 3: migrate and prune utilities

Audit every tracked `bin/*` entry for behavior, references, documentation, platform, external dependencies, overlap, and current usefulness. Each entry receives one outcome:

- `migrate`: retain the command name and reproduce its useful contract as Bun/TypeScript.
- `merge`: fold duplicated behavior into one retained command or the lifecycle CLI.
- `delete`: remove obsolete, abandoned, unsafe, or fully duplicated behavior.

Clear deletion decisions do not require individual approval. They require evidence that no managed config, documentation, test, or other retained command depends on the candidate. Git history provides historical recovery.

Migration proceeds in independently verifiable groups:

1. Text and filesystem helpers.
2. Git and project helpers.
3. Network and secret-aware helpers.
4. Maintenance and environment-update helpers.

Lifecycle behavior belongs under `dotfiles`; general-purpose daily tools remain standalone commands. A lifecycle command explicitly superseded by `dotfiles`, such as the legacy update entry point, is deleted rather than shimmed.

### Wave 4: replace legacy provisioning

Audit each `setup/*.sh` operation against the supported task catalog. Preserve useful behavior as typed, dependency-aware tasks with platform, privilege, preflight, apply, and verify contracts. Historical tweaks that are unsafe, unsupported, or no longer wanted are documented as rejected and deleted rather than copied forward.

A legacy setup script is removed only after all retained behavior has task coverage and isolated tests. The new setup path never executes a legacy script.

### Wave 5: consolidate operations and documentation

Finish the supported lifecycle surface:

```text
dotfiles setup
dotfiles apply [--dry-run]
dotfiles sync [--dry-run] [--no-push]
dotfiles update [--dry-run] [--no-push]
dotfiles audit [--json] [--strict]
dotfiles doctor
dotfiles backups list|restore|prune
dotfiles edit
```

`sync` and `update` own explicit batch commits and pushes. Setup and apply converge the machine but never publish implicitly. Direct source-edit workflows remain subject to the same local validation hooks. Batch operations disable incidental chezmoi Git automation for the invocation.

Replace command-sized documentation with `docs/commands.md`, generated or validated against the executable inventory. Retain only substantive setup, recovery, architecture, security, and workflow guides. Remove completed transitional plans after their durable requirements and operational guidance are incorporated into maintained documents.

## Bun utility contract

Every retained executable under `bin/` is extensionless, executable, and begins with:

```typescript
#!/usr/bin/env bun
```

The file contains strict TypeScript understood directly by Bun. Commands that invoke external programs use:

```typescript
import { $ } from "bun";
```

Bun Shell is the only shell-command construction mechanism under `bin/`. User-controlled and filesystem-derived values are passed through `${value}` interpolation so Bun treats them as literal arguments. Raw command fragments, `bash -c`, `sh -c`, and equivalent system-shell escapes are prohibited. External-program option injection remains the command's responsibility, so user operands must be validated or separated from options where the target supports `--`.

Commands preserve their observable stdin, stdout, stderr, flags, and exit behavior unless the audit explicitly records an intentional correction. A command validates its platform and required external executables before mutation. macOS-only commands remain available on macOS and return a concise unsupported-platform error elsewhere.

Shared domain behavior belongs in `src/utilities/`; the executable remains a direct Bun entry point rather than a generated shell wrapper. Internal helpers that are not public commands leave `bin/` and move into `src/` or are deleted.

After migration, static validation rejects legacy interpreters, `.mjs`, `.js`, `.py`, and `.sh` programs under `bin/`. Dependencies such as `zx`, `ora`, `open`, and `pretty-bytes-cli` are removed when the retained source no longer imports or invokes them.

## Safety and recovery

All potentially destructive HOME migrations use the existing private backup service. Archives live under `~/.local/state/dotfiles/backups/<timestamp>/` with `0700` directories and a `0600` versioned manifest. The manifest records target-relative paths, types, modes, reasons, and restore paths without secret contents.

Each migration wave follows:

```text
inventory
  -> validate complete classification and prerequisites
  -> show deterministic plan
  -> capture required backup
  -> apply one bounded wave
  -> verify behavior and convergence
  -> remove only the replaced legacy surface
  -> verify again
```

Validation failure causes no mutation. Apply or verification failure stops the active wave; later waves do not continue. Reruns calculate work from observed state rather than success markers. Backup restore and prune operations reject traversal, operate only on registered manifests, and require explicit targets.

Repository deletions use exact tracked paths. Broad recursive cleanup against HOME, the repository root, unresolved environment variables, or globs is prohibited.

## CLI experience and error handling

Interactive setup prints the resolved task table, dependencies, platform, risk, privilege requirements, and proposed mutations before confirmation. Dry-run output includes the same information. Structured logger fields cannot be hidden from the human-readable plan.

`dotfiles apply` detects absent or incompatible machine configuration and prints the exact `dotfiles setup` remediation. `audit` and `doctor` are read-only. Commands return stable non-zero exit codes for validation, unsupported platform, dependency, cancellation, and partial-update failures. Machine-readable output has a versioned deterministic schema.

Console errors remain concise; detailed structured diagnostics go to private durable logs. Logs, output, manifests, inventories, and Git validation findings redact secret-shaped values and private local-policy data.

## Testing and completion gates

Utility migration requires:

- A shebang and executable-mode assertion for every retained `bin/*` entry.
- Static rejection of legacy interpreters and unsafe system-shell escapes.
- Contract tests for flags, streams, exit codes, platform handling, and required tools.
- Isolated temporary directories for filesystem and Git behavior.
- macOS and Linux coverage for portable commands and explicit rejection tests for platform-specific commands.
- A command-reference completeness test against `docs/commands.md`.

Repository-wide CI requires:

- Bun unit, contract, and integration tests.
- Strict TypeScript validation.
- ShellCheck and Bash syntax validation for `install.sh` only.
- Zsh syntax validation for managed shell configuration.
- Secret, path, file-type, and source-policy validation.
- Isolated bootstrap and apply runs on macOS and Ubuntu, including a no-op second run.
- HOME ledger and inventory determinism checks.

Cleanup is complete only when all of these are true:

- Git status is clean and repository tests pass.
- No broken repository symlink exists.
- No live managed HOME target is a compatibility or Mackup symlink.
- HOME audit reports zero unclassified, duplicate, or unknown-schema targets.
- Every retained `bin/*` executable satisfies the Bun contract.
- No legacy `bin` interpreter or duplicate extension variant remains.
- No deprecated setup script remains without an accepted replacement or recorded rejection.
- No tracked Mackup configuration remains.
- No unused package dependency or stale command-only document remains.
- Existing SSH and GPG private material is unchanged and unreachable from Git.

## Documentation source of truth

Maintained user documentation is limited to the README, setup, recovery, command reference, synchronization/update workflow, and security/architecture material. Historical design records may remain while active implementation depends on them; completed checkbox plans and superseded command guides are removed after their durable decisions have been incorporated.

The README reports the supported current surface, not future commands. Future lifecycle commands cannot be advertised as available before implementation.
