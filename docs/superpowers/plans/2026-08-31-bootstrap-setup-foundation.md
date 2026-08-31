# Bootstrap and Setup Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the destructive macOS-only bootstrap and `sync.py` deployment with a rerunnable macOS/Ubuntu/Debian installer, a strict TypeScript `dotfiles setup|apply|edit` CLI, and chezmoi-managed regular files.

**Architecture:** `install.sh` performs only pre-runtime detection and Bun/chezmoi/repository bootstrap. The Bun CLI owns typed orchestration through injected process, filesystem, prompt, platform, and privilege adapters. Chezmoi owns HOME file state under `home/`; setup tasks express state convergence through preflight/apply/verify contracts.

**Tech Stack:** Bash 3.2-compatible bootstrap, Bun, strict TypeScript, Commander, `@clack/prompts`, chezmoi, Bun test, ShellCheck.

**Spec:** `docs/superpowers/specs/2026-08-27-dotfiles-refactor-foundation-design.md`

## Global Constraints

- Support only macOS and Ubuntu/Debian; reject everything else before mutation.
- Keep `~/.dotfiles`, the public HTTPS remote, `.chezmoiroot -> home`, and regular-file deployment.
- Never reset, clean, overwrite, or stash an existing checkout. Never run Bun or chezmoi wholesale as root.
- Treat setup as convergence: current state is authoritative; saved completion markers are forbidden.
- Run all selected preflights before the first mutation. Stop on the first failed setup task.
- Back up conflicting HOME targets before apply. Backups are private and never automatically deleted.
- Preserve unrelated utility commands and deprecated `setup/*` scripts in this plan.
- Use argument arrays with `Bun.spawn`; never compose shell command strings from user or secret input.
- Keep secrets out of configuration, output, logs, fixtures, and Git.
- Before each commit, run the task-specific tests and `bun run typecheck` once it exists.

---

## Task 1: Establish the Bun CLI toolchain and command boundary

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
- Modify: `tsconfig.json`
- Create: `src/cli/main.ts`
- Create: `src/cli/dependencies.ts`
- Create: `src/lib/process.ts`
- Create: `src/lib/logger.ts`
- Create: `src/lib/filesystem.ts`
- Create: `src/lib/platform.ts`
- Create: `src/lib/paths.ts`
- Create: `src/lib/prompts.ts`
- Create: `tests/cli/main.test.ts`

**Interfaces:** Produces `CliDependencies`, `createProgram()`, and the stable executable entry point consumed by all later commands.

- [ ] Add a failing routing test proving `setup`, `apply`, and `edit` are registered and an unknown command exits non-zero without executing a process.

```ts
import { describe, expect, test } from "bun:test";
import { createProgram } from "../../src/cli/main";
import { createFakeDependencies } from "../support/fakes";

describe("createProgram", () => {
  test("registers the Stage 1 foundation commands", () => {
    const program = createProgram(createFakeDependencies());
    expect(program.commands.map((command) => command.name())).toEqual(["setup", "apply", "edit"]);
  });
});
```

- [ ] Run `bun test tests/cli/main.test.ts`; confirm failure because the CLI modules and fake dependencies do not exist.
- [ ] Add `commander` and `@clack/prompts` with `bun add commander @clack/prompts`; add scripts `typecheck` and `test` to `package.json`; replace the Node engine declaration with Bun `>=1.2`.
- [ ] Change `tsconfig.json` to include `src/**/*.ts`, `tests/**/*.ts`, and TypeScript files under `bin`; enable `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `useUnknownInCatchVariables`.
- [ ] Define the adapter interfaces in the listed `src/lib/*` files, with no production side effects: `ProcessRunner`, `Logger`, `FileSystem`, `SupportedPlatform`, `DotfilesPaths`, and `PromptAdapter`. Create `src/cli/dependencies.ts` with the explicit dependency container; do not use globals in command handlers.

```ts
export interface CliDependencies {
  readonly process: ProcessRunner;
  readonly fs: FileSystem;
  readonly prompts: PromptAdapter;
  readonly logger: Logger;
  readonly platform: SupportedPlatform;
  readonly paths: DotfilesPaths;
}
```

- [ ] Create `createProgram(dependencies)` in `src/cli/main.ts`. Disable implicit process exit with `program.exitOverride()`, dispatch through injected foundation command handlers, and expose `runCli(argv, dependencies): Promise<number>` for tests. Production dependency construction and executable wiring belong to Task 2.
- [ ] Add `tests/support/fakes.ts` with deterministic in-memory adapters used by all plans.
- [ ] Run `bun test tests/cli/main.test.ts && bun run typecheck`; confirm pass.
- [ ] Commit: `git add package.json bun.lock tsconfig.json src/cli src/lib tests/cli tests/support && git commit -m "feat: add typed dotfiles cli foundation"`

## Task 2: Implement safe process, logging, filesystem, and platform adapters

**Files:**
- Modify: `package.json`
- Modify: `src/lib/process.ts`
- Modify: `src/lib/logger.ts`
- Modify: `src/lib/filesystem.ts`
- Modify: `src/lib/platform.ts`
- Modify: `src/lib/paths.ts`
- Modify: `src/lib/prompts.ts`
- Create: `src/lib/errors.ts`
- Create: `src/cli/production.ts`
- Create: `bin/dotfiles`
- Create: `tests/lib/process.test.ts`
- Create: `tests/lib/platform.test.ts`
- Create: `tests/lib/logger.test.ts`

**Interfaces:** Produces the infrastructure contracts consumed by setup, backups, chezmoi, sync, update, audit, and doctor.

- [ ] Add failing tests for Darwin/arm64, Linux Ubuntu/Debian detection, unsupported distributions, command redaction, and creation of private state/log directories.
- [ ] Define process contracts using argument arrays and explicit sensitive argument indices.

```ts
export interface CommandSpec {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly stdin?: "inherit" | "ignore";
  readonly sensitiveArgs?: readonly number[];
}

export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface ProcessRunner {
  run(spec: CommandSpec): Promise<CommandResult>;
  which(executable: string): Promise<string | null>;
}
```

- [ ] Implement `BunProcessRunner` with `Bun.spawn`, captured stdout/stderr by default, inherited stdin only when requested, non-throwing exit capture, and sanitized logging before execution.
- [ ] Define `Logger` with `debug/info/warn/error` methods accepting message plus structured fields. Implement a console + durable-file logger writing to `~/.local/state/dotfiles/logs/<UTC timestamp>.log` with mode `0600`.
- [ ] Implement recursive redaction for keys matching `token|secret|password|authorization|cookie|private.?key` and command arguments listed in `sensitiveArgs`. Test that raw fixture secrets never reach memory logs.
- [ ] Define a minimal `FileSystem` interface around only required operations: `exists`, `lstat`, `readText`, `readBytes`, `writeTextAtomic`, `writeBytesAtomic`, `mkdir`, `rename`, `copyFile`, `chmod`, `readdir`, `realpath`, `removeEmptyDirectory`, `removeTree`, and `mkdtemp`.
- [ ] Implement `NodeFileSystem` using `node:fs/promises`; use same-directory temp files plus rename for atomic writes.
- [ ] Implement `ClackPromptAdapter` behind the Task 1 interface. Treat cancellation as typed `UserCancelledError`; never call `process.exit` inside the adapter.
- [ ] Define platform and path values.

```ts
export type OperatingSystem = "macos" | "ubuntu" | "debian";
export type CpuArchitecture = "arm64" | "x64";
export interface SupportedPlatform {
  readonly os: OperatingSystem;
  readonly arch: CpuArchitecture;
  readonly homeDir: string;
}

export interface DotfilesPaths {
  readonly repo: string;
  readonly state: string;
  readonly logs: string;
  readonly backups: string;
  readonly chezmoiConfig: string;
  readonly localConfig: string;
}
```

- [ ] Detect Linux distribution from `/etc/os-release`; accept only `ubuntu` and `debian`. Normalize `x86_64` to `x64` and `aarch64` to `arm64`. Throw a typed `UnsupportedPlatformError` before dependency construction completes.
- [ ] Create `createProductionDependencies()` in `src/cli/production.ts`, then create executable `bin/dotfiles` with `#!/usr/bin/env bun`; construct dependencies, call `runCli`, set `process.exitCode`, and run `chmod +x bin/dotfiles`. Add the `dotfiles` package script.
- [ ] Run `bun test tests/lib && bun run typecheck`; confirm pass.
- [ ] Commit: `git add package.json bin/dotfiles src/cli/production.ts src/lib tests/lib tests/support && git commit -m "feat: add safe runtime adapters"`

## Task 3: Build dependency-aware, rerunnable setup tasks

**Files:**
- Create: `src/setup/types.ts`
- Create: `src/setup/graph.ts`
- Create: `src/setup/selection.ts`
- Create: `src/setup/runner.ts`
- Create: `src/setup/prompts.ts`
- Create: `tests/setup/graph.test.ts`
- Create: `tests/setup/selection.test.ts`
- Create: `tests/setup/runner.test.ts`

**Interfaces:** Consumes `CliDependencies`. Produces resolved setup plans and execution summaries used by `dotfiles setup`.

- [ ] Add failing tests for transitive dependency selection, cycle/unknown dependency rejection, platform filtering, saved defaults, `--select`/`--skip` precedence, all-preflight-before-apply ordering, first-failure stop, and rerun convergence.
- [ ] Define the task model exactly once in `src/setup/types.ts`.

```ts
export type CheckResult =
  | { readonly ok: true; readonly detail?: string }
  | { readonly ok: false; readonly detail: string; readonly remediation?: string };

export interface TaskContext extends CliDependencies {
  readonly dryRun: boolean;
}

export interface SetupTask {
  readonly id: string;
  readonly title: string;
  readonly platforms: readonly OperatingSystem[];
  readonly dependencies: readonly string[];
  readonly defaultSelected: boolean;
  readonly risk: "low" | "medium" | "high";
  readonly privilege: "user" | "command-sudo";
  preflight(context: TaskContext): Promise<CheckResult>;
  apply(context: TaskContext): Promise<void>;
  verify(context: TaskContext): Promise<CheckResult>;
}
```

- [ ] Implement stable topological sorting by declaration order, automatic dependency inclusion, and explicit diagnostics for cycles and unknown IDs.
- [ ] Define `SelectionInput { saved, selected, skipped, nonInteractive }`. Apply precedence `skip > select > saved > task default`; reject skipping a dependency required by a selected task.
- [ ] Wrap `@clack/prompts` behind `PromptAdapter`; cancellation returns exit code 130 and performs no mutation. Show dependencies, risk, and sudo requirements in the confirmed plan.
- [ ] Implement `SetupRunner`: preflight every task first; if any fail, apply none. Apply/verify in dependency order. Record per-task timing and sanitized errors. Do not write success markers.
- [ ] Inject a failure after any fake adapter operation and prove a second run only performs missing mutations.
- [ ] Run `bun test tests/setup && bun run typecheck`; confirm pass.
- [ ] Commit: `git add src/setup tests/setup tests/support && git commit -m "feat: add convergent setup task engine"`

## Task 4: Add private conflict backup and manifest recovery primitives

**Files:**
- Create: `src/backups/types.ts`
- Create: `src/backups/service.ts`
- Create: `tests/backups/service.test.ts`
- Create: `tests/fixtures/home-conflicts/`

**Interfaces:** Consumes filesystem/path adapters. Produces `BackupArchive` and `BackupManifest` for setup apply and later backup commands.

- [ ] Add failing tests proving regular files, directories, and legacy symlinks move under a timestamped relative path; permissions/type/reason are recorded; archive and manifest modes are private; identical files are not backed up; no source outside HOME can be archived.
- [ ] Define versioned manifest types.

```ts
export interface BackupEntry {
  readonly source: string;
  readonly relativePath: string;
  readonly backupPath: string;
  readonly type: "file" | "directory" | "symlink";
  readonly mode: number;
  readonly reason: "chezmoi-conflict" | "legacy-symlink" | "repository-conflict" | "chezmoi-config-migration";
}

export interface BackupManifest {
  readonly version: 1;
  readonly createdAt: string;
  readonly homeDir: string;
  readonly entries: readonly BackupEntry[];
}
```

- [ ] Implement lexical and realpath containment checks against the injected HOME. Never follow a conflicting symlink while copying or moving it.
- [ ] Create `~/.local/state/dotfiles/backups/<YYYYMMDDTHHMMSSZ>/` as `0700`; write `manifest.json` atomically as `0600` after each successful move so interruption remains recoverable.
- [ ] Add `discoverChezmoiConflicts(targets)` that compares target type/content against rendered expected files and returns only actual conflicts.
- [ ] Run `bun test tests/backups && bun run typecheck`; confirm pass.
- [ ] Commit: `git add src/backups tests/backups tests/fixtures/home-conflicts && git commit -m "feat: back up managed file conflicts safely"`

## Task 5: Configure chezmoi against the existing checkout

**Files:**
- Create: `.chezmoiroot`
- Create: `src/chezmoi/config.ts`
- Create: `src/chezmoi/client.ts`
- Create: `src/chezmoi/targets.ts`
- Create: `tests/chezmoi/config.test.ts`
- Create: `tests/chezmoi/client.test.ts`

**Interfaces:** Consumes process/filesystem/path adapters and backup service. Produces machine configuration and safe chezmoi commands for setup/apply.

- [ ] Add failing tests for exact config JSON, source directory validation, strict template options, invocation-local Git suppression, target enumeration, old TOML/state backup, and non-destructive handling of stale `~/.local/share/chezmoi`.
- [ ] Write `.chezmoiroot` containing exactly `home` plus newline.
- [ ] Define machine configuration and JSON serialization.

```ts
export interface MachineConfig {
  readonly version: 1;
  readonly sourceDir: string;
  readonly platform: OperatingSystem;
  readonly selectedTasks: readonly string[];
  readonly git: { readonly autoCommit: true; readonly autoPush: true };
}
```

The emitted `~/.config/chezmoi/chezmoi.json` must use chezmoi keys `sourceDir`, `mode: "file"`, `git.autoCommit`, `git.autoPush`, and `data.dotfiles` containing the version/platform/selections. Write it `0600` and never serialize local secrets.

- [ ] Before replacing config, archive existing `chezmoi.toml`, `chezmoi.json`, and the state database through `BackupService`. Report but do not mutate stale default source state.
- [ ] Implement `ChezmoiClient` methods `managedTargets`, `diff`, `apply`, `verifyTemplates`, and `executeWithGitDisabled`. Every invocation passes `--config <absolute path>` and `--source <repo>` explicitly.
- [ ] Validate that the configured repository resolves to `~/.dotfiles` and contains `.chezmoiroot`; reject unrelated source directories.
- [ ] Run `bun test tests/chezmoi && bun run typecheck`; confirm pass.
- [ ] Commit: `git add .chezmoiroot src/chezmoi tests/chezmoi && git commit -m "feat: configure chezmoi source state"`

## Task 6: Migrate current shell state into `home/`

**Files:**
- Create: `home/` equivalents for every current `shell/*` deployment target
- Create: `home/dot_gitconfig`
- Create: `home/dot_config/dotfiles/local.example.json`
- Modify: `home/dot_zshrc`
- Modify: `zsh/aliases.zsh`
- Replace with symlinks: current `shell/*` managed files
- Create: `tests/chezmoi/source-state.test.ts`
- Create: `tests/fixtures/expected-managed-targets.json`

**Interfaces:** Consumes the exact `sync.py` target list. Produces complete chezmoi source state while keeping one-cycle repository compatibility symlinks.

- [ ] Extract the current `sync.py` mapping into `expected-managed-targets.json`; add a failing test asserting each target has one source under `home/`, no source is a secret, and every legacy `shell/*` path resolves to that source.
- [ ] Move each managed shell file into chezmoi naming form, preserving bytes and executable modes. Include the Brewfile as `home/dot_Brewfile` and Mackup config only as an unmigrated audit input—not active chezmoi state.
- [ ] Make each migrated `shell/*` path a relative repository symlink to its `home/` source. Do not create HOME symlinks.
- [ ] Move public Git name/email defaults from the current `.gitlocal` into managed Git config while retaining an optional include of unmanaged `~/.gitlocal`.
- [ ] Keep `.zshlocal` unmanaged and optional. Ensure managed `.zshrc` sources it only when readable.
- [ ] Remove five token exports from any managed/public source. Add on-demand Keychain reads only inside the commands that consume each token; never export them globally. Preserve non-secret project paths, work identity, PATH additions, and Lando socket in the existing local file on this machine.
- [ ] Replace `alias dotfiles=...` with CLI completion-safe behavior; `dotfiles edit` will own editor opening. Keep `~/.dotfiles/bin` on PATH.
- [ ] Add template-data documentation via `local.example.json` with non-secret keys and dummy values only; ensure `~/.config/dotfiles/local.json` remains ignored and unmanaged.
- [ ] Run `bun test tests/chezmoi/source-state.test.ts && bun run typecheck`; run `zsh -n home/dot_zshrc zsh/*.zsh` and `git config --file home/dot_gitconfig --list` using the actual migrated filename.
- [ ] Commit: `git add home shell zsh tests/chezmoi/source-state.test.ts tests/fixtures/expected-managed-targets.json && git commit -m "feat: migrate shell state to chezmoi"`

## Task 7: Implement foundation setup tasks and commands

**Files:**
- Create: `src/setup/tasks/core-tools.ts`
- Create: `src/setup/tasks/homebrew.ts`
- Create: `src/setup/tasks/shell.ts`
- Create: `src/setup/tasks/git.ts`
- Create: `src/setup/catalog.ts`
- Create: `src/commands/setup.ts`
- Create: `src/commands/apply.ts`
- Create: `src/commands/edit.ts`
- Modify: `src/cli/main.ts`
- Create: `tests/setup/tasks.test.ts`
- Create: `tests/commands/foundation.test.ts`

**Interfaces:** Consumes setup engine, chezmoi client, and backup service. Produces working `dotfiles setup`, `dotfiles apply`, and `dotfiles edit`.

- [ ] Add failing task contract tests for macOS and Linux command construction, missing-only package installation, no broad upgrades, per-command sudo, explicit Linux login-shell confirmation, and apply backup ordering.
- [ ] Implement only real Stage 1 task groups: `core-tools`, `homebrew-packages`, `shell`, and `git`. Do not display future GUI/preferences/server/application placeholder tasks.
- [ ] `core-tools` verifies Bun, chezmoi, Git, and supported platform. `homebrew-packages` installs Homebrew only if absent, then runs `brew bundle check --global` and `brew bundle install --global --no-upgrade` against the managed Brewfile.
- [ ] On Ubuntu/Debian, install only missing Homebrew bootstrap prerequisites via `sudo apt-get install`; call `sudo` as the executable for that command only. Never invoke the CLI process under sudo.
- [ ] `shell` validates Zsh and asks separately before `chsh -s <brew-zsh>` on Linux. `git` sets repository-local `core.hooksPath=.githooks` and reports `gh auth login` / `gh auth setup-git` when push auth is unavailable.
- [ ] Implement `dotfiles setup [--non-interactive] [--select <id...>] [--skip <id...>] [--dry-run]`: load saved selections, resolve, display, preflight, back up, run tasks, apply chezmoi, verify, then atomically save selections only after success.
- [ ] Implement `dotfiles apply [--dry-run]`: validate templates and source, compute diff, back up conflicts, apply, verify no remaining diff. A push failure is a warning only when apply itself succeeds.
- [ ] Implement `dotfiles edit`: choose `$GUI_EDITOR`, then `$VISUAL`, then `$EDITOR`, else `code`; split only the configured executable token safely and pass the repo as one argument.
- [ ] Run `bun test tests/setup/tasks.test.ts tests/commands/foundation.test.ts && bun run typecheck`; confirm pass.
- [ ] Commit: `git add src/setup/tasks src/setup/catalog.ts src/commands src/cli/main.ts tests/setup/tasks.test.ts tests/commands/foundation.test.ts && git commit -m "feat: implement foundation setup commands"`

## Task 8: Replace `install.sh` with the portable bootstrap

**Files:**
- Modify: `install.sh`
- Create: `tests/bootstrap/install.bats`
- Create: `tests/bootstrap/helpers.bash`
- Create: `tests/fixtures/os-release/ubuntu`
- Create: `tests/fixtures/os-release/debian`

**Interfaces:** Produces the sole published entry point and hands off all post-bootstrap arguments to `bin/dotfiles setup`.

- [ ] Add failing Bats tests for supported OS/architecture detection, unsupported rejection before downloads, non-root enforcement, missing TTY behavior, existing correct/dirty checkout preservation, unrelated checkout backup, HTTPS clone, install failure propagation, and setup argument forwarding.
- [ ] Rewrite `install.sh` for Bash 3.2 with `set -euo pipefail`. Keep it dependency-light: `uname`, `command`, `curl`, `git`, `mkdir`, `mv`, and basic POSIX utilities only.
- [ ] Accept `--non-interactive`, repeated `--select`, repeated `--skip`, and `--dry-run`. Require a TTY unless non-interactive is explicit.
- [ ] Detect macOS or parse `/etc/os-release` for Ubuntu/Debian; normalize `arm64/aarch64` and `x86_64`. Reject root and unsupported values before filesystem or network mutation.
- [ ] Install current stable chezmoi and Bun from official HTTPS installers only when missing. Re-resolve PATH afterward and verify each executable responds successfully.
- [ ] Initialize absent `~/.dotfiles` from `https://github.com/semencov/dotfiles.git`. For an existing directory, verify Git worktree and exact canonical remote; preserve dirty state. Move unrelated/corrupt directories into the private backup root using a timestamp, then clone.
- [ ] Launch `"$BUN_BIN" "$DOTFILES_DIR/bin/dotfiles" setup` with forwarded arguments. Never run setup, Bun, or chezmoi under sudo.
- [ ] Run `bats tests/bootstrap/install.bats`, `shellcheck install.sh`, and `bash -n install.sh`; confirm pass.
- [ ] Commit: `git add install.sh tests/bootstrap tests/fixtures/os-release && git commit -m "feat: add portable rerunnable bootstrap"`

## Task 9: Prove isolated installation and retire `sync.py`

**Files:**
- Create: `tests/integration/foundation-install.test.ts`
- Create: `tests/integration/fixtures/bin/`
- Delete: `sync.py`
- Modify: `README.md`
- Create: `docs/setup.md`
- Create: `docs/recovery.md`

**Interfaces:** Verifies the complete Plan 1 flow. Removes legacy deployment only after coverage proves every target is managed.

- [ ] Add an integration test using a temporary HOME and fake package executables that runs local `install.sh --non-interactive`, verifies regular target files and private backups, mutates one managed target, reruns, and verifies convergence without duplicate work.
- [ ] Add a real-chezmoi integration case for `chezmoi execute-template`, `diff`, and two consecutive `apply` calls against a temporary HOME. Skip with an explicit reason only when the binary is absent locally; CI must install it.
- [ ] Run the managed-target completeness test and inspect its generated list. Only then delete `sync.py`.
- [ ] Rewrite README installation to the sole documented URL:

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/semencov/dotfiles/HEAD/install.sh)"
```

- [ ] Document interactive/non-interactive setup, selections, supported platforms, HTTPS/GitHub auth behavior, local config, reruns, logs, conflict backup layout, and manual recovery. Mark `setup/*` deprecated but do not remove it.
- [ ] Run `bun test && bun run typecheck && shellcheck install.sh && bash -n install.sh && zsh -n home/dot_zshrc zsh/*.zsh`.
- [ ] Inspect `git diff --check` and `git status --short`; confirm no HOME path, secret, generated log, or unrelated modification is staged.
- [ ] Commit: `git add README.md docs/setup.md docs/recovery.md tests/integration sync.py && git commit -m "test: verify foundation installation lifecycle"`

## Plan 1 Acceptance

- [ ] On a temporary macOS HOME, execute local `install.sh --non-interactive` twice; second run reports no managed-file or foundation-package mutation.
- [ ] On an Ubuntu/Debian container or CI runner, repeat the same test without changing the login shell or running the CLI as root.
- [ ] Confirm every former `sync.py` target is a regular file after apply and every legacy repository symlink remains valid.
- [ ] Confirm a seeded conflicting file and legacy HOME symlink are recoverable from a `0700` archive with a `0600` manifest.
- [ ] Confirm an unsupported OS exits before download, clone, backup, or package mutation.
- [ ] Record the exact passing command output in the implementation handoff; proceed to Plan 2 only after all checks pass.
