# Bun Utility Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every retained program under `bin/` with an extensionless, strict TypeScript Bun executable that uses Bun Shell for external processes, while deleting obsolete and duplicated programs.

**Architecture:** A versioned command catalog records the complete public `bin/` surface, platform support, and migration outcome. Extensionless entry points own CLI parsing and streams; reusable behavior lives in focused `src/utilities/` modules. Contract tests execute commands in isolated directories with controlled PATH fixtures, while static tests enforce shebang, executable mode, and process-safety rules.

**Tech Stack:** Bun 1.4+, Bun Shell, strict TypeScript, Bun test, Commander only for the `dotfiles` lifecycle CLI.

**Spec:** `docs/superpowers/specs/2026-09-02-repository-cleanup-design.md`

## Prerequisites

- Complete `docs/superpowers/plans/2026-09-02-foundation-activation-transition-cleanup.md`.
- Complete `docs/superpowers/plans/2026-08-31-state-sync-update.md` and `docs/superpowers/plans/2026-08-31-home-state-migration-ci.md` so `dotfiles update`, repository validation, CI, and HOME ownership exist before utility retirement.
- Do not implement or retain a legacy `update` shim; `dotfiles update` is its accepted replacement.

## Global Constraints

- Every retained `bin/*` file starts with `#!/usr/bin/env bun` and has executable mode.
- Entry points are extensionless; no `.js`, `.mjs`, `.py`, or `.sh` program remains under `bin/`.
- External commands are constructed with Bun Shell and escaped `${value}` interpolation.
- `bash -c`, `sh -c`, `eval`, raw interpolated command fragments, and equivalent shell escapes are prohibited.
- Preserve existing command names and observable streams/exit codes unless the catalog records an explicit correction.
- macOS-specific commands reject other platforms before mutation.
- Tests use synthetic credentials and isolated files only.
- Clear duplicates, unsafe abandoned commands, and superseded lifecycle commands are deleted automatically after reference validation.

---

## Task 1: Define and enforce the public command catalog

**Files:**
- Create: `config/commands.json`
- Create: `src/utilities/catalog.ts`
- Create: `src/utilities/types.ts`
- Create: `tests/utilities/catalog.test.ts`
- Create: `tests/utilities/bin-contract.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `CommandDefinition`, `CommandCatalog.load()`, and the authoritative list used by tests and documentation.

- [ ] **Step 1: Add failing schema and filesystem contract tests**

```typescript
export type CommandPlatform = "macos" | "ubuntu" | "debian";

export interface CommandDefinition {
  readonly name: string;
  readonly summary: string;
  readonly platforms: readonly CommandPlatform[];
  readonly externalTools: readonly string[];
}
```

Test that the catalog rejects unknown keys, duplicate names, names containing `/` or an extension, unsupported platforms, unsorted entries, missing summaries, and duplicate external tools. Add a migration audit that compares the current `bin/` tree to `commands` plus `deleted`, reports each legacy shebang/extension as an expected pending migration, and fails only for an unclassified file.

- [ ] **Step 2: Run and record the legacy failures**

Run: `bun test tests/utilities/catalog.test.ts tests/utilities/bin-contract.test.ts`

Expected: FAIL because the catalog and parser are absent.

- [ ] **Step 3: Implement strict catalog parsing**

Use explicit runtime guards; do not use a permissive type assertion after `JSON.parse`. Sort definitions by `name`, normalize no data, and reject any input that is not already canonical. Export:

```typescript
export class CommandCatalog {
  static async load(path: string): Promise<CommandCatalog>;
  readonly commands: readonly CommandDefinition[];
  get(name: string): CommandDefinition | undefined;
}
```

- [ ] **Step 4: Seed the exact retained command surface**

Catalog these 52 extensionless names:

```text
cb chromedriver clbin cleandropbox codepoint confirm crlf domains dotfiles
escape extract git-cleanup git-diff-master git-fix-user git-fork git-github
git-pager git-standup git-stats git-upstream git-user gz headers help ip-geo
ip-lan ip-query ip-wan lso passphrase pem phpserver pj-archive pj-clean pk
rename repo resetperm rsync-from rsync-to secret-delete secret-get secret-set
server ssh-add-host ssh-key starship-git-simple teams-active update-namecheap
wg yolo zsh_history_fix
```

Set `platforms` to all three supported systems except:

```text
macos only: chromedriver, secret-delete, secret-get, secret-set, teams-active
macos + ubuntu + debian with platform adapters: cb, ip-lan, server
```

All unlisted retained commands are portable across the three supported systems subject to their declared external tools.

Record the planned deletion set outside the runtime command array as migration metadata:

```json
{
  "deleted": {
    "backup": "obsolete CloudApp dependency and unsafe plaintext database credential flow",
    "emptytrash": "unsafe broad sudo deletion of volume trash and system logs",
    "help.mjs": "duplicate of help",
    "ip-wan.mjs": "duplicate of ip-wan",
    "spinningPromise.mjs": "internal helper, not a public executable",
    "update": "superseded by dotfiles update",
    "update.mjs": "duplicate legacy updater superseded by dotfiles update"
  }
}
```

The parser accepts only the exact top-level keys `version`, `commands`, and `deleted`; `version` is `1`.

- [ ] **Step 5: Add static safety assertions**

Define `assertMigratedBinContract()` for the final aggregate gate. It rejects these byte patterns:

```text
#!/bin/bash
#!/usr/bin/env bash
#!/usr/bin/env zsh
#!/usr/bin/env node
#!/usr/bin/env zx
bash -c
sh -c
eval(
{ raw:
```

Allow `install.sh` outside `bin/`. During migration, the audit test passes only when every violation is already represented by an exact retained or deleted catalog entry. Task 7 switches the aggregate assertion from classified-pending mode to `assertMigratedBinContract()` and requires zero violations. Require TypeScript checking to include extensionless `bin/*` through an explicit generated import test rather than relying on filename inference.

- [ ] **Step 6: Verify and commit the catalog and migration audit**

Run: `bun test tests/utilities/catalog.test.ts tests/utilities/bin-contract.test.ts && bun run typecheck`

Expected: PASS with every current file classified and the known legacy violations reported as pending migration data.

```bash
git add config/commands.json src/utilities/catalog.ts src/utilities/types.ts tests/utilities/catalog.test.ts tests/utilities/bin-contract.test.ts .gitignore
git commit -m "test: define Bun utility migration contract"
```

Each later migration commit must keep the catalog audit green. The strict final aggregate becomes mandatory in Task 7.

## Task 2: Add shared Bun utility runtime primitives

**Files:**
- Create: `src/utilities/runtime.ts`
- Create: `src/utilities/arguments.ts`
- Create: `src/utilities/platform.ts`
- Create: `src/utilities/terminal.ts`
- Create: `tests/utilities/runtime.test.ts`
- Create: `tests/utilities/arguments.test.ts`
- Create: `tests/utilities/platform.test.ts`
- Create: `tests/utilities/helpers.ts`

**Interfaces:**
- Produces: `runUtility`, `parseOperands`, `requirePlatform`, `requireTools`, `confirm`, and consistent public errors.

- [ ] **Step 1: Add failing runtime tests**

```typescript
test("runUtility maps typed usage errors to exit 2", async () => {
  const result = await captureUtility(() => runUtility(async () => {
    throw new UtilityUsageError("Usage: example <file>");
  }));
  expect(result).toEqual({ exitCode: 2, stdout: "", stderr: "Usage: example <file>\n" });
});

test("requirePlatform rejects Linux before executing a mutation", async () => {
  const mutate = mock(() => Promise.resolve());
  await expect(withPlatform("ubuntu", () => requirePlatform(["macos"], mutate)))
    .rejects.toThrow("supported only on macOS");
  expect(mutate).not.toHaveBeenCalled();
});
```

Cover usage exit `2`, operational exit `1`, cancellation `130`, passthrough child exit codes, missing tools, `--` operand separation, TTY confirmation, and non-TTY refusal.

Implement test-only `captureUtility(operation)` by replacing `process.stdout.write`, `process.stderr.write`, and `process.exitCode` inside `try/finally`. Implement `withPlatform(os, operation)` by injecting `OperatingSystem` into `requirePlatform`; never mutate `process.platform`.

- [ ] **Step 2: Run and confirm missing-module failures**

Run: `bun test tests/utilities/runtime.test.ts tests/utilities/arguments.test.ts tests/utilities/platform.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement the runtime boundary**

```typescript
export async function runUtility(operation: () => Promise<number | void>): Promise<void> {
  try {
    process.exitCode = await operation() ?? 0;
  } catch (error) {
    const failure = toUtilityFailure(error);
    process.stderr.write(`${failure.message}\n`);
    process.exitCode = failure.exitCode;
  }
}

export async function requireTools(names: readonly string[]): Promise<void> {
  const missing: string[] = [];
  for (const name of names) {
    if ((await $`which ${name}`.nothrow().quiet()).exitCode !== 0) missing.push(name);
  }
  if (missing.length > 0) throw new UtilityDependencyError(missing);
}
```

Use Bun Shell only through escaped interpolation. `confirm(message)` reads one line from `Bun.stdin`; it returns `false` without a TTY unless an explicit force option was already parsed by the caller.

- [ ] **Step 4: Verify primitives**

Run: `bun test tests/utilities/runtime.test.ts tests/utilities/arguments.test.ts tests/utilities/platform.test.ts && bun run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utilities/runtime.ts src/utilities/arguments.ts src/utilities/platform.ts src/utilities/terminal.ts tests/utilities/runtime.test.ts tests/utilities/arguments.test.ts tests/utilities/platform.test.ts tests/utilities/helpers.ts
git commit -m "feat: add Bun utility runtime"
```

## Task 3: Migrate text, archive, and filesystem commands

**Files:**
- Modify in place: `bin/codepoint`, `bin/confirm`, `bin/crlf`, `bin/escape`, `bin/extract`, `bin/gz`, `bin/lso`, `bin/pem`, `bin/pk`, `bin/rename`, `bin/resetperm`, `bin/wg`, `bin/zsh_history_fix`
- Rename: `bin/passphrase.mjs` to `bin/passphrase`
- Create: `src/utilities/archive.ts`
- Create: `src/utilities/crlf.ts`
- Create: `src/utilities/encoding.ts`
- Create: `src/utilities/files.ts`
- Create: `tests/utilities/text-files.test.ts`
- Create: `tests/commands/text-files.test.ts`

**Interfaces:**
- Consumes: Task 2 runtime primitives.
- Produces: fourteen migrated direct commands and reusable archive/text functions.

- [ ] **Step 1: Add table-driven failing command tests**

Use `Bun.spawn` with an isolated temporary directory and fixture PATH. Assert:

```typescript
const cases = [
  ["codepoint", ["£"], "\\x00A3\n"],
  ["escape", ["£"], "\\xC2\\xA3\n"],
  ["passphrase", ["--words", "4"], /^[a-z]+(?:-[a-z]+){3}\n$/],
] as const;
```

Also cover CRLF detection/conversion, archive extension dispatch, gzip/Brotli byte ratios, certificate inspection, exact rename preview/apply behavior, reset-permission containment, replacement confirmation for `wg`, and history recovery with backup-before-replace.

Destructive commands default to preview/refusal and require their existing explicit force/replace flag. `resetperm` refuses `/`, HOME, and the repository root.

- [ ] **Step 2: Run focused tests and confirm legacy failures**

Run: `bun test tests/utilities/text-files.test.ts tests/commands/text-files.test.ts`

Expected: FAIL on legacy shebangs and unsafe/untyped behavior.

- [ ] **Step 3: Implement pure transformations first**

Export:

```typescript
export function unicodeCodePoint(value: string): string;
export function escapeUtf8(value: string): string;
export function hasCrlf(bytes: Uint8Array): boolean;
export function normalizeCrlf(bytes: Uint8Array): Uint8Array;
export function archiveKind(path: string): "tar.bz2" | "tar.gz" | "bz2" | "rar" | "gz" | "tar" | "zip" | "7z" | "xz";
```

Reject empty/multi-code-point `codepoint` input. Use byte-safe Bun file APIs for CRLF. Use explicit archive-kind argument arrays through Bun Shell; never reconstruct a command string.

- [ ] **Step 4: Rewrite every listed entry point directly**

Each file starts with the Bun shebang, imports `$` when it executes an external program, parses `Bun.argv.slice(2)`, and ends with `runUtility`. Preserve command names; the only rename is `passphrase.mjs -> passphrase`.

- [ ] **Step 5: Verify the group and executable modes**

```bash
bun test tests/utilities/text-files.test.ts tests/commands/text-files.test.ts
bun run typecheck
git diff --check
```

Expected: PASS. Confirm `git ls-files --stage bin/*` reports mode `100755` for all migrated entries.

- [ ] **Step 6: Commit**

```bash
git add bin/codepoint bin/confirm bin/crlf bin/escape bin/extract bin/gz bin/lso bin/passphrase bin/pem bin/pk bin/rename bin/resetperm bin/wg bin/zsh_history_fix src/utilities/archive.ts src/utilities/crlf.ts src/utilities/encoding.ts src/utilities/files.ts tests/utilities/text-files.test.ts tests/commands/text-files.test.ts
git add -u bin/passphrase.mjs
git commit -m "refactor: migrate file utilities to Bun Shell"
```

## Task 4: Migrate Git and project commands

**Files:**
- Modify: `bin/git-cleanup`, `bin/git-diff-master`, `bin/git-fix-user`, `bin/git-fork`, `bin/git-github`, `bin/git-pager`, `bin/git-standup`, `bin/git-upstream`, `bin/git-user`, `bin/help`, `bin/pj-archive`, `bin/pj-clean`, `bin/repo`, `bin/starship-git-simple`, `bin/yolo`
- Rename: `bin/git-stats.sh` to `bin/git-stats`
- Create: `src/utilities/git.ts`
- Create: `src/utilities/projects.ts`
- Create: `tests/utilities/git.test.ts`
- Create: `tests/commands/git-project.test.ts`

**Interfaces:**
- Consumes: command catalog, runtime primitives, Bun Shell.
- Produces: sixteen migrated direct commands with Git operations represented as escaped arguments.

- [ ] **Step 1: Add failing Git fixture tests**

Create temporary bare remotes and working clones. Cover:

- default-branch discovery through `refs/remotes/origin/HEAD`, falling back to `main`, then `master`;
- diff-file listing without word splitting;
- `git-cleanup` preview versus `--force`, never deleting the current branch or a branch with local-only commits;
- upstream add/sync with validated owner and branch arguments;
- repository-local Git identity read/update;
- GitHub repository creation command construction without embedding tokens;
- standup Monday/weekday date boundaries using an injected clock;
- pager child-exit propagation;
- stats date parsing and commit lookup;
- dirty/clean prompt rendering;
- `yolo` refusal without staged changes and literal generated commit messages.

- [ ] **Step 2: Run focused tests and confirm failures**

Run: `bun test tests/utilities/git.test.ts tests/commands/git-project.test.ts`

Expected: FAIL on hard-coded branches, legacy interpreters, and absent modules.

- [ ] **Step 3: Implement typed Git/project helpers**

Export exact operations:

```typescript
export async function discoverDefaultBranch(cwd: string): Promise<string>;
export async function changedFilesSinceDefault(cwd: string, pattern?: RegExp): Promise<readonly string[]>;
export async function cleanupCandidates(cwd: string, now: Date): Promise<readonly BranchCandidate[]>;
export async function findProject(projectRoots: readonly string[], query: string): Promise<string>;
```

Define the result type in `src/utilities/git.ts`:

```typescript
export interface BranchCandidate {
  readonly name: string;
  readonly reason: "gone-upstream" | "old-and-merged";
  readonly lastCommit: number;
}
```

Use `git for-each-ref` machine formats and parse output in TypeScript. Never pipe Git output through `awk`, `grep`, or `eval`. Read project roots from unmanaged `local.json`, falling back to `~/Projects`; do not retain the hard-coded `~/_` path.

- [ ] **Step 4: Rewrite listed entry points and rename `git-stats.sh`**

Keep `help` catalog-driven. Keep `yolo` as a direct Bun command and add full types for spinner/editor input and the `fx ask` response. Validate a generated message is one line and at most 256 characters before passing it as one interpolated Git argument.

- [ ] **Step 5: Verify**

```bash
bun test tests/utilities/git.test.ts tests/commands/git-project.test.ts
bun run typecheck
git diff --check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add bin/git-cleanup bin/git-diff-master bin/git-fix-user bin/git-fork bin/git-github bin/git-pager bin/git-standup bin/git-stats bin/git-upstream bin/git-user bin/help bin/pj-archive bin/pj-clean bin/repo bin/starship-git-simple bin/yolo src/utilities/git.ts src/utilities/projects.ts tests/utilities/git.test.ts tests/commands/git-project.test.ts
git add -u bin/git-stats.sh
git commit -m "refactor: migrate Git utilities to Bun Shell"
```

## Task 5: Migrate network and remote-service commands

**Files:**
- Modify: `bin/cb`, `bin/clbin`, `bin/cleandropbox`, `bin/headers`, `bin/ip-geo`, `bin/ip-lan`, `bin/ip-query`, `bin/ip-wan`, `bin/update-namecheap`
- Rename: `bin/domains.mjs` to `bin/domains`
- Create: `src/utilities/clipboard.ts`
- Create: `src/utilities/network.ts`
- Create: `src/utilities/namecheap.ts`
- Create: `tests/utilities/network.test.ts`
- Create: `tests/commands/network.test.ts`

**Interfaces:**
- Produces: eleven migrated network commands; secrets are confined to request bodies/query construction and redacted from errors.

- [ ] **Step 1: Add failing HTTP/DNS/clipboard tests**

Use a local `Bun.serve` fixture and injected DNS resolver. Cover clipboard read/write on macOS and Linux, clbin URL parsing, Dropbox conflict detection versus explicit deletion, HEAD redirects, public/local IP parsing, geolocation/query JSON errors, bounded domain concurrency, and Namecheap XML success/failure.

Assert Namecheap passwords never appear in stdout, stderr, thrown messages, or captured Bun Shell command logs. `--verbose` may print a URL only with `password=[REDACTED]`.

- [ ] **Step 2: Run focused tests and confirm failures**

Run: `bun test tests/utilities/network.test.ts tests/commands/network.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement typed HTTP, DNS, and platform adapters**

Use native `fetch` for HTTP and `node:dns/promises` for DNS; use Bun Shell only for platform tools such as `pbcopy`, `pbpaste`, `xclip`, and network-interface discovery. Limit `domains` to 16 concurrent lookups and set a per-query timeout.

Parse service responses into explicit types:

```typescript
export interface PublicIpResult { readonly ip: string; }
export interface NamecheapResult { readonly errors: readonly string[]; }
```

Reject non-IP responses and malformed XML/JSON.

- [ ] **Step 4: Rewrite entry points and rename `domains.mjs`**

Preserve command names and flags. `cleandropbox` defaults to reporting and requires `--remove`; it uses `Bun.Glob` and deletes exact matched files without following symlinks.

- [ ] **Step 5: Verify and commit**

```bash
bun test tests/utilities/network.test.ts tests/commands/network.test.ts
bun run typecheck
git diff --check
git add bin/cb bin/clbin bin/cleandropbox bin/domains bin/headers bin/ip-geo bin/ip-lan bin/ip-query bin/ip-wan bin/update-namecheap src/utilities/clipboard.ts src/utilities/network.ts src/utilities/namecheap.ts tests/utilities/network.test.ts tests/commands/network.test.ts
git add -u bin/domains.mjs
git commit -m "refactor: migrate network utilities to Bun"
```

## Task 6: Migrate local services, transfers, and identity helpers

**Files:**
- Rename: `bin/chromedriver.sh` to `bin/chromedriver`
- Modify: `bin/phpserver`, `bin/rsync-from`, `bin/rsync-to`, `bin/secret-delete`, `bin/secret-get`, `bin/secret-set`, `bin/server`, `bin/ssh-add-host`, `bin/ssh-key`, `bin/teams-active`
- Create: `src/utilities/keychain.ts`
- Create: `src/utilities/rsync.ts`
- Create: `src/utilities/server.ts`
- Create: `src/utilities/ssh.ts`
- Create: `tests/utilities/local-services.test.ts`
- Create: `tests/commands/local-services.test.ts`

**Interfaces:**
- Consumes: Task 2 runtime/platform primitives.
- Produces: eleven migrated commands with guarded destructive/network behavior.

- [ ] **Step 1: Add failing command-construction and safety tests**

Cover:

- `chromedriver` macOS rejection, installed-driver validation, quarantine removal against `command -v` result, and foreground exit propagation;
- PHP server and Bun static server validated ports `1..65535`;
- rsync refusal rules and literal remote operands;
- Keychain get/set/delete using service and account arguments with secret value marked sensitive;
- SSH key generation only when the selected public key is absent;
- SSH host config backup, exact stanza writing, unique key path, and no private-key content reads;
- Teams activation cancellation/SIGINT and macOS-only behavior.

Use fake executables and synthetic key headers only. No test touches the real Keychain, SSH directory, Teams, or network.

- [ ] **Step 2: Run focused tests and confirm failures**

Run: `bun test tests/utilities/local-services.test.ts tests/commands/local-services.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement typed services**

Use `Bun.serve` for `server`; use Bun Shell for PHP, rsync, security, ssh, ssh-keygen, osascript, and chromedriver. Do not execute Python 2. For rsync, preserve `--delete` only after TTY confirmation or explicit `--force`; always separate remote/local operands from options.

Keychain writes interpolate the value as one literal argument and keep it out of error messages. `ssh-add-host` writes through an atomic file replacement after backing up the current config; it never expands `~` inside an IdentityFile value incorrectly.

- [ ] **Step 4: Rewrite entry points and rename `chromedriver.sh`**

All listed commands use the common runtime and validate platform/tools before mutation. `chromedriver` launches the installed binary and does not perform upgrades; upgrades belong to `dotfiles update`.

- [ ] **Step 5: Verify and commit**

```bash
bun test tests/utilities/local-services.test.ts tests/commands/local-services.test.ts
bun run typecheck
git diff --check
git add bin/chromedriver bin/phpserver bin/rsync-from bin/rsync-to bin/secret-delete bin/secret-get bin/secret-set bin/server bin/ssh-add-host bin/ssh-key bin/teams-active src/utilities/keychain.ts src/utilities/rsync.ts src/utilities/server.ts src/utilities/ssh.ts tests/utilities/local-services.test.ts tests/commands/local-services.test.ts
git add -u bin/chromedriver.sh
git commit -m "refactor: migrate service utilities to Bun Shell"
```

## Task 7: Delete obsolete programs and remove legacy dependencies

**Files:**
- Delete: `bin/backup`
- Delete: `bin/emptytrash`
- Delete: `bin/help.mjs`
- Delete: `bin/ip-wan.mjs`
- Delete: `bin/spinningPromise.mjs`
- Delete: `bin/update`
- Delete: `bin/update.mjs`
- Modify: `package.json`
- Modify: `bun.lock`
- Modify: `home/dot_Brewfile`
- Modify: `zsh/aliases.zsh`
- Modify: relevant tests and references found by repository search

**Interfaces:**
- Consumes: migrated command groups and implemented `dotfiles update`.
- Produces: zero legacy interpreters and zero obsolete command references.

- [ ] **Step 1: Add failing reference and dependency tests**

Assert repository text outside design/history docs contains no command reference to deleted entries, no import from `zx`, `ora`, `open`, or `pretty-bytes-cli`, and no Brewfile/package dependency retained solely for deleted commands.

- [ ] **Step 2: Verify each deletion rationale against the tree**

Use exact repository searches for each name. Block deletion if a live Zsh alias, managed config, current guide, test, or retained executable still invokes it. Historical Git commits and dated design records do not count as live references.

- [ ] **Step 3: Delete the exact seven files with `apply_patch`**

Do not create wrappers or shims. Remove their aliases/current documentation in the same change. Keep `dotfiles update` as the only updater.

- [ ] **Step 4: Remove unused packages with Bun**

Remove `zx`, `ora`, `open`, and `pretty-bytes-cli` after source search proves no imports. Remove `diff-so-fancy` only if `git-pager` has migrated to the Homebrew binary; otherwise move it from package dependencies to `home/dot_Brewfile` and update the catalog external tool.

Run:

```bash
bun install
bun install --frozen-lockfile
```

Expected: lockfile is stable on the second command.

- [ ] **Step 5: Run aggregate contracts**

```bash
bun test tests/utilities tests/commands
bun run typecheck
git diff --check
```

Expected: all pass; catalog and filesystem sets are identical; no legacy interpreter pattern remains.

- [ ] **Step 6: Commit**

```bash
git add bin package.json bun.lock home/dot_Brewfile zsh/aliases.zsh tests
git commit -m "refactor: remove obsolete utility programs"
```

## Task 8: Consolidate the command reference and CI gates

**Files:**
- Create: `src/utilities/docs.ts`
- Create: `docs/commands.md`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Delete after content migration: command-only files under `docs/`
- Create: `tests/utilities/docs.test.ts`

**Interfaces:**
- Consumes: `config/commands.json` and each command's `--help` output.
- Produces: one deterministic command reference and an aggregate migration gate.

- [ ] **Step 1: Add a failing deterministic documentation test**

Generate Markdown sections sorted by catalog name with summary, platforms, external tools, and captured `--help`. Assert generated bytes equal `docs/commands.md` and every command returns `0` for `--help` without requiring its external tools or performing mutation.

- [ ] **Step 2: Implement the generator**

```typescript
export async function renderCommandReference(
  catalog: CommandCatalog,
  help: (name: string) => Promise<string>,
): Promise<string>;
```

Output one title, a generated-file notice, and one `## command` section per entry. Normalize line endings and one final newline. Do not include local paths or environment values.

- [ ] **Step 3: Consolidate existing guides**

Move retained executable usage into generated command help, then delete these exact command-only or stale guides:

```text
docs/br.md
docs/cleandropbox.md
docs/clone.md
docs/crlf.md
docs/g.md
docs/gist-paste.md
docs/git-bitbucket.md
docs/git-cleanup.md
docs/git-fork.md
docs/git-github.md
docs/git-standup.md
docs/git-upstream.md
docs/gz.md
docs/passphrase.md
docs/repo.md
docs/server.md
docs/ssh-key.md
docs/wg.md
```

`br`, `clone`, and Gist aliases remain self-documented beside their definitions in `zsh/aliases.zsh`; they are not executable catalog entries. `docs/g.md` and `docs/git-bitbucket.md` are removed as stale because their described commands do not match the current shell surface. Retain and rewrite `docs/update.md` for `dotfiles update`; retain `docs/setup.md` and `docs/recovery.md`.

- [ ] **Step 4: Add package and CI commands**

Add:

```json
{
  "scripts": {
    "check:bin": "bun test tests/utilities/bin-contract.test.ts tests/utilities/docs.test.ts",
    "docs:commands": "bun src/utilities/docs.ts --write"
  }
}
```

Run `bun run check:bin` in macOS and Ubuntu CI after typecheck.

- [ ] **Step 5: Run the full gate**

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
bun run check:bin
shellcheck install.sh
bash -n install.sh
zsh -n home/dot_zshrc zsh/*.zsh
git diff --check
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/utilities/docs.ts docs README.md package.json .github/workflows/ci.yml tests/utilities/docs.test.ts
git commit -m "docs: consolidate Bun utility reference"
```

## Acceptance

- [ ] The catalog contains exactly the 52 retained extensionless command names.
- [ ] Every `bin/*` file is executable and starts with `#!/usr/bin/env bun`.
- [ ] No `.mjs`, `.js`, `.py`, or `.sh` program remains under `bin/`.
- [ ] No retained `bin/*` source contains a legacy interpreter, system-shell escape, or raw Bun Shell interpolation.
- [ ] Portable commands pass macOS and Ubuntu contract tests; macOS-only commands reject Linux before mutation.
- [ ] The seven deletion outcomes have no live references and no compatibility shims.
- [ ] `dotfiles update` is the only updater.
- [ ] Unused Node/zx-era dependencies are absent.
- [ ] `docs/commands.md` exactly matches the executable catalog.
- [ ] Full tests, typecheck, bootstrap, syntax, security, and repository validation pass.
