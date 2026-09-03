# Legacy Provisioning and Repository Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the useful parts of `setup/*.sh`, reject obsolete unsafe behavior, remove dead repository structure, normalize file ownership/modes, and leave concise maintained documentation.

**Architecture:** A versioned legacy ledger assigns every old setup operation an exact `replace` or `reject` outcome. Retained Node and macOS preference behavior becomes typed setup tasks with preflight/apply/verify contracts and private rollback state. Finalization then deletes legacy scripts/assets, removes interpreter residue, normalizes modes, and collapses completed plans into maintained architecture and operations docs.

**Tech Stack:** Bun 1.4+, strict TypeScript, Bun Shell, macOS `defaults`, fnm, chezmoi, Bun test, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-02-repository-cleanup-design.md`

## Prerequisites

- Complete foundation activation and transition cleanup.
- Complete state sync/update, HOME/Mackup migration, and Bun utility migration plans.
- Require `dotfiles audit --strict` and `dotfiles doctor` to pass before deleting migration sources.

## Global Constraints

- Do not execute any `setup/*.sh` file.
- Do not copy forward an operation without an exact desired-state check and verification command.
- macOS preferences are opt-in, individually typed, reversible, and limited to the allowlist in Task 3.
- Reject all SSD kernel/power/storage tweaks and EOL PHP 7/phpbrew provisioning.
- Node remains only for project compatibility; Bun remains the repository and global TypeScript runtime.
- Do not use a permanent sudo keepalive; elevate one command at a time.
- Remove exact reviewed paths only; no broad cleanup of HOME or repository root.

---

## Task 1: Create the legacy provisioning ledger

**Files:**
- Create: `config/legacy-setup.json`
- Create: `src/setup/legacy-ledger.ts`
- Create: `tests/setup/legacy-ledger.test.ts`

**Interfaces:**
- Produces: `LegacySetupLedger.load()` and a complete machine-readable disposition for every active command in `setup/*.sh`.

- [ ] **Step 1: Add failing strict-schema and completeness tests**

```typescript
export interface LegacyOperation {
  readonly id: string;
  readonly source: "node.sh" | "osx.sh" | "php.sh" | "ssd.sh" | "zsh.sh";
  readonly line: number;
  readonly command: string;
  readonly outcome: "replace" | "reject";
  readonly owner: string;
  readonly rationale: string;
}
```

Parse active, non-comment shell commands with a fixture-only scanner and assert every command is represented exactly once by `source + line`. Reject unknown keys, duplicate IDs/locations, empty rationale, and owners that do not name a setup task or rejection class.

- [ ] **Step 2: Run and confirm failure**

Run: `bun test tests/setup/legacy-ledger.test.ts`

Expected: FAIL because the ledger does not exist.

- [ ] **Step 3: Implement strict parsing and seed exact outcomes**

Assign outcomes by source:

```text
node.sh
  replace: fnm install/use/default LTS -> development-runtimes task
  replace: public npm configuration -> HOME-state managed npm configuration
  replace: public global CLI list -> install-only inventories
  reject: ~/.npm-global and ~/.pnpm-global prefixes, npm-global TypeScript runtime,
          duplicate pnpm/yarn/corepack ownership

osx.sh
  replace: only the preference allowlist in Task 3 -> macos-preferences task
  reject: sudo keepalive, Gatekeeper disable, NVRAM changes, login-window disclosure,
          hibernation/SMS/power changes, legacy Bluetooth codec domains, Apache/rcd
          launchctl changes, disk-image verification disable, Dashboard settings,
          application force-kill loop, and obsolete application preference domains

php.sh
  reject: all operations; PHP 7.3/7.4 and phpbrew flow are EOL, global sudo symlinks
          are unsafe, and current PHP ownership belongs to project containers/tooling

ssd.sh
  reject: all operations; obsolete storage assumptions and destructive system changes

zsh.sh
  replace: Homebrew/Zsh packages -> homebrew-packages task
  replace: login shell -> shell task
  reject: broad brew update during setup and shell-based installer execution
```

The ledger stores normalized command identifiers and line locations, never secret values or expanded HOME paths.

- [ ] **Step 4: Verify deterministic completeness**

Run the scanner twice and compare serialized results byte-for-byte. Then run:

```bash
bun test tests/setup/legacy-ledger.test.ts
bun run typecheck
```

Expected: PASS with zero unclassified active operations.

- [ ] **Step 5: Commit**

```bash
git add config/legacy-setup.json src/setup/legacy-ledger.ts tests/setup/legacy-ledger.test.ts
git commit -m "test: classify legacy provisioning behavior"
```

## Task 2: Add project-compatible Node provisioning

**Files:**
- Create: `src/setup/tasks/development-runtimes.ts`
- Modify: `src/setup/catalog.ts`
- Modify: `src/chezmoi/config.ts`
- Create: `tests/setup/development-runtimes.test.ts`
- Modify: `tests/setup/tasks.test.ts`

**Interfaces:**
- Consumes: setup task model, process runner, platform, and saved selections.
- Produces: setup task `development-runtimes` depending on `homebrew-packages`.

- [ ] **Step 1: Add failing task contract tests**

Test these states:

```text
fnm absent                 -> preflight fails with Brewfile remediation
fnm present, no LTS        -> apply runs fnm install --lts
LTS present, wrong default -> apply runs fnm default <resolved-version>
already converged          -> no mutation
dry-run                    -> prints exact missing actions only
```

Assert no command uses `npm install --global`, changes npm/pnpm prefixes, invokes corepack, or installs Bun-managed CLIs through Node.

- [ ] **Step 2: Run and confirm missing-task failure**

Run: `bun test tests/setup/development-runtimes.test.ts tests/setup/tasks.test.ts`

Expected: FAIL because the task is absent.

- [ ] **Step 3: Implement observed-state convergence**

Use Bun Shell/process arguments equivalent to:

```text
fnm list --lts
fnm install --lts
fnm default <resolved-lts-version>
```

Parse `fnm list` output into a typed installed-version set. Do not rely on a marker file. Set `defaultSelected: true`, platforms macOS/Ubuntu/Debian, risk `low`, privilege `user`, and dependency `homebrew-packages`.

Public npm settings and global CLIs remain owned by HOME state and inventories; this task must not duplicate them.

- [ ] **Step 4: Verify**

Run: `bun test tests/setup/development-runtimes.test.ts tests/setup/tasks.test.ts && bun run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/setup/tasks/development-runtimes.ts src/setup/catalog.ts src/chezmoi/config.ts tests/setup/development-runtimes.test.ts tests/setup/tasks.test.ts
git commit -m "feat: provision project Node runtime safely"
```

## Task 3: Replace legacy macOS defaults with a reversible allowlist

**Files:**
- Create: `config/macos-preferences.json`
- Create: `src/preferences/types.ts`
- Create: `src/preferences/registry.ts`
- Create: `src/preferences/macos.ts`
- Create: `src/setup/tasks/macos-preferences.ts`
- Modify: `src/setup/catalog.ts`
- Create: `tests/preferences/registry.test.ts`
- Create: `tests/preferences/macos.test.ts`
- Create: `tests/setup/macos-preferences.test.ts`

**Interfaces:**
- Produces: typed preference reads/writes/restores and opt-in task `macos-preferences`.

- [ ] **Step 1: Add failing registry tests**

```typescript
export interface MacOSPreference {
  readonly id: string;
  readonly domain: string;
  readonly key: string;
  readonly type: "bool" | "int" | "string";
  readonly value: boolean | number | string;
  readonly restart: readonly string[];
}
```

Reject unknown keys, duplicate `domain + key`, type/value mismatch, `sudo` domains, absolute user paths, shell fragments, and unregistered restart applications.

- [ ] **Step 2: Seed the exact allowlist**

```text
NSGlobalDomain NSAutomaticQuoteSubstitutionEnabled bool false
NSGlobalDomain NSAutomaticDashSubstitutionEnabled bool false
NSGlobalDomain NSAutomaticSpellingCorrectionEnabled bool false
NSGlobalDomain NSNavPanelExpandedStateForSaveMode bool true
NSGlobalDomain NSNavPanelExpandedStateForSaveMode2 bool true
NSGlobalDomain PMPrintingExpandedStateForPrint bool true
NSGlobalDomain PMPrintingExpandedStateForPrint2 bool true
NSGlobalDomain NSDocumentSaveNewDocumentsToCloud bool false
NSGlobalDomain NSQuitAlwaysKeepsWindows bool false
com.apple.screensaver askForPassword int 1
com.apple.screensaver askForPasswordDelay int 0
com.apple.desktopservices DSDontWriteNetworkStores bool true
com.apple.finder FXDefaultSearchScope string SCcf
com.apple.finder FXEnableExtensionChangeWarning bool false
com.apple.dock mru-spaces bool false
com.apple.TextEdit RichText int 0
com.apple.TextEdit PlainTextEncoding int 4
com.apple.TextEdit PlainTextEncodingForWrite int 4
com.apple.ActivityMonitor ShowCategory int 0
```

Restart ownership is empty except Finder keys -> `Finder`, Dock key -> `Dock`, and Activity Monitor key -> `Activity Monitor`. Restarts are reported, not forced.

- [ ] **Step 3: Add failing read/apply/rollback tests**

Test exact `defaults read-type`, `defaults read`, and typed `defaults write` argument construction. Before the first changed write, save the original existence/type/value in a private `0600` JSON manifest under `~/.local/state/dotfiles/preferences/`. A failed write restores only writes completed by that invocation, in reverse order.

Linux preflight marks the task unavailable without invoking `defaults`. The task is `defaultSelected: false`, risk `medium`, privilege `user`, macOS-only.

- [ ] **Step 4: Implement and verify**

Do not use `killall`; print the unique affected app names after success. Verification rereads every selected preference and compares typed values.

Run: `bun test tests/preferences tests/setup/macos-preferences.test.ts && bun run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add config/macos-preferences.json src/preferences src/setup/tasks/macos-preferences.ts src/setup/catalog.ts tests/preferences tests/setup/macos-preferences.test.ts
git commit -m "feat: add reversible macOS preferences"
```

## Task 4: Remove the Node completion helper and normalize Zsh modules

**Files:**
- Rename: `zsh/plugins/npm-scripts/get-scripts.cjs` to `zsh/plugins/npm-scripts/get-scripts`
- Modify: `zsh/plugins/npm-scripts/npm-scripts-autocomplete.plugin.zsh`
- Modify: `zsh/plugins/npm-scripts/README.md`
- Create: `tests/zsh/npm-scripts.test.ts`
- Modify: `tests/chezmoi/source-state.test.ts`

**Interfaces:**
- Produces: Bun-backed package-script completion with no Node/CommonJS program in the repository.

- [ ] **Step 1: Add failing completion tests**

Execute the helper against fixture `package.json` files containing absent scripts, ordinary scripts, spaces, colons, dollar signs, malformed JSON, and prototype-shaped keys. Assert deterministic escaped Zsh completion lines and non-zero malformed-input handling.

- [ ] **Step 2: Rewrite the helper as direct Bun TypeScript**

The extensionless helper begins with `#!/usr/bin/env bun`, reads the exact path from `Bun.argv[2]`, parses via `Bun.file(path).json()`, validates `scripts` as a record of strings, sorts keys, and prints `${escapedName}:$ ${escapedCommand}`. Escape only Zsh completion metacharacters required by the consumer.

Change the plugin invocation from `node .../get-scripts.cjs` to the executable `.../get-scripts` path. Do not invoke a shell or `bun run` wrapper.

- [ ] **Step 3: Normalize Zsh source modes**

Set sourced `.zsh` files and plugin README files to `0644`. Only the direct `get-scripts` helper remains `0755`. Add a source-state assertion that non-entrypoint documentation/configuration is not executable.

- [ ] **Step 4: Verify and commit**

```bash
bun test tests/zsh/npm-scripts.test.ts tests/chezmoi/source-state.test.ts
bun run typecheck
zsh -n home/dot_zshrc zsh/*.zsh zsh/plugins/*/*.zsh
git diff --check
git add zsh tests/zsh/npm-scripts.test.ts tests/chezmoi/source-state.test.ts
git commit -m "refactor: use Bun for package-script completion"
```

## Task 5: Delete classified legacy setup and dead assets

**Files:**
- Delete: `setup/node.sh`
- Delete: `setup/osx.sh`
- Delete: `setup/php.sh`
- Delete: `setup/ssd.sh`
- Delete: `setup/zsh.sh`
- Delete: `.node-version`
- Delete: `.gitmodules`
- Delete: `misc/Ayu-mirage.icls`
- Delete: `misc/CodeStyle.xml`
- Delete: `misc/Elementary.itermcolors`
- Delete: `misc/Elementary.terminal`
- Delete: `misc/iterm2.json`
- Delete: `misc/userpic.png`
- Modify: `config/legacy-setup.json`
- Modify: `config/sync-policy.json`
- Modify: `tests/setup/legacy-ledger.test.ts`
- Create: `tests/repository/structure.test.ts`

**Interfaces:**
- Consumes: accepted replacement tasks and rejection ledger.
- Produces: no legacy setup executables, stale submodule declaration, Node runtime pin, or unreferenced asset directory.

- [ ] **Step 1: Add failing final-structure tests**

Assert `setup/`, `misc/`, `.node-version`, and `.gitmodules` are absent. Assert every legacy ledger entry has `verified: true` plus either a replacement task/test identifier or a rejection rationale. Require all three removed `.gitmodules` paths to be absent from the Git index and Zsh loader.

- [ ] **Step 2: Verify removal evidence**

Run exact repository searches for every setup filename and every `misc/` basename. Current runtime/config/documentation references block deletion; dated specs and the legacy ledger may retain names. Confirm `.gitmodules` declares only three submodules that are absent from the index and unused because equivalent Zsh plugins come from Homebrew.

- [ ] **Step 3: Mark ledger verification and delete exact paths**

Set `verified: true` only after the owning tests pass. Remove `shell`, `setup`, and `misc` from `config/sync-policy.json.repositoryPaths`; policy entries may not reference those roots. Use `apply_patch` to delete the exact files above. Do not use recursive shell deletion.

- [ ] **Step 4: Normalize repository file modes**

Require mode `0755` only for `install.sh`, direct `bin/*` commands, `.githooks/*`, and executable test fixtures. Set Markdown, JSON, TOML, configs, images, TypeScript modules/tests, and sourced Zsh modules to `0644`. Add these rules to `tests/repository/structure.test.ts`.

- [ ] **Step 5: Verify and commit**

```bash
bun test tests/setup tests/preferences tests/repository/structure.test.ts
bun run typecheck
git diff --check
git add config/legacy-setup.json config/sync-policy.json tests/setup/legacy-ledger.test.ts tests/repository/structure.test.ts
git add -u -- setup misc .node-version .gitmodules
git commit -m "refactor: remove legacy provisioning and dead assets"
```

## Task 6: Consolidate maintained documentation and remove completed plans

**Files:**
- Create: `docs/architecture.md`
- Modify: `README.md`
- Modify: `docs/setup.md`
- Modify: `docs/recovery.md`
- Modify: `docs/commands.md`
- Modify: `docs/sync.md`
- Modify: `docs/home-state.md`
- Modify: `docs/security.md`
- Modify: `docs/migration-report.md`
- Delete after consolidation: obsolete command-only `docs/*.md`
- Retain: approved design records under `docs/superpowers/specs/`
- Create: `tests/repository/documentation.test.ts`

**Interfaces:**
- Produces: concise current documentation with no advertised future surface and no completed checkbox plans.

- [ ] **Step 1: Add failing documentation ownership tests**

Define the maintained user-document allowlist:

```text
README.md
docs/architecture.md
docs/commands.md
docs/home-state.md
docs/migration-report.md
docs/recovery.md
docs/security.md
docs/setup.md
docs/sync.md
docs/update.md
```

Allow dated design specs under `docs/superpowers/specs/`. Exclude implementation plans from the user-document allowlist while execution is active. Reject other user guides, broken relative links, references to `shell/`, `setup/*.sh`, Mackup as active tooling, legacy update commands, deleted utilities/assets, and commands absent from the CLI/catalog.

- [ ] **Step 2: Write the maintained architecture document**

Consolidate stable decisions from the foundation and cleanup specs: repository boundaries, chezmoi ownership, Bun Shell contract, setup task model, HOME classifications, sync/update transaction, security hooks, backups, and platform support. It must describe current code only.

- [ ] **Step 3: Consolidate unique operational content**

Move unique recovery/workflow details from old command-specific guides into the maintained allowlist. `docs/commands.md` remains generated from the catalog. Delete command-only guides after their generator-equivalent help is verified.

- [ ] **Step 4: Verify documentation and commit**

```bash
bun test tests/repository/documentation.test.ts tests/utilities/docs.test.ts
bun run docs:commands
git diff --exit-code docs/commands.md
git diff --check
git add README.md docs tests/repository/documentation.test.ts
git commit -m "docs: consolidate maintained dotfiles documentation"
```

## Task 7: Run final repository and live-machine acceptance

**Files:**
- Modify only if a verified failure requires a focused correction.
- Delete after every acceptance check passes: completed files under `docs/superpowers/plans/`

**Interfaces:**
- Consumes: every completed migration plan.
- Produces: final sanitized implementation handoff.

- [ ] **Step 1: Run the complete repository gate**

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
bun run check:bin
shellcheck install.sh
bash -n install.sh
zsh -n home/dot_zshrc zsh/*.zsh zsh/plugins/*/*.zsh
brew bundle list --file home/dot_Brewfile >/dev/null
bin/dotfiles internal validate --tree HEAD
git diff --check
```

- [ ] **Step 2: Run live read-only diagnostics**

```bash
dotfiles doctor
dotfiles audit --strict
dotfiles apply --dry-run
```

Expected: all exit `0`, no managed drift, no stale compatibility/Mackup links, no unknown HOME candidates, and no missing remediation.

- [ ] **Step 3: Verify protected and rollback state**

Compare final `.zshlocal`, `.gitlocal`, SSH, and GPG private evidence with the pre-migration records. Verify the iCloud Mackup directory remains present and untouched, backup manifests validate, and private state permissions are `0700`/`0600`.

- [ ] **Step 4: Verify repository minimality**

Require:

```text
zero broken links
zero legacy bin interpreters/extensions
zero tracked Mackup files
zero setup/*.sh files
zero unused package dependencies
zero unreferenced misc assets
zero completed implementation plans
zero stale command docs
clean Git status
```

- [ ] **Step 5: Remove completed implementation plans and finalize**

Record exact passing counts and sanitized ledger totals in the implementation handoff. If a correction was required, rerun the full gate and commit it with a scoped message first.

After all checks pass, delete the completed checkbox plan files under `docs/superpowers/plans/`, including this file. Keep approved specs as decision history and link only `docs/architecture.md` from the README. Commit the plan retirement:

```bash
git add -u -- docs/superpowers/plans
git commit -m "docs: retire completed implementation plans"
git status --short --branch
```

Expected: clean status after the final commit.

## Acceptance

- [ ] Every legacy setup command has a verified replacement or explicit rejection.
- [ ] Node provisioning is project-compatibility-only and installs no global npm toolchain.
- [ ] macOS preferences are limited to the exact opt-in reversible allowlist.
- [ ] PHP 7/phpbrew and SSD/system-destructive scripts are absent.
- [ ] No CommonJS/Node utility residue remains in Zsh completion.
- [ ] `setup/`, `misc/`, `.node-version`, and stale `.gitmodules` are absent.
- [ ] Only intended entry points and fixtures are executable.
- [ ] Maintained docs match the actual command/configuration surface.
- [ ] Completed plan files are removed after their requirements are consolidated.
- [ ] Full repository and live-machine diagnostics pass with protected private material unchanged.
