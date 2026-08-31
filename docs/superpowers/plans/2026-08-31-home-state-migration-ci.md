# HOME State Migration, Recovery, and CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Account for every Mackup and selected HOME configuration target, migrate approved stable state to chezmoi or Keychain without losing local SSH/GPG material, retire Mackup safely, complete diagnostics/recovery commands, and continuously verify macOS and Ubuntu/Debian behavior.

**Architecture:** A versioned ledger classifies every discovered target as `git`, `keychain`, `regenerate`, or `exclude`; zero unclassified entries is a hard migration gate. A `home-state` setup task executes only ledger-approved actions through backups, normalizers, chezmoi, and Keychain adapters. Read-only audit/doctor commands continuously detect drift and new candidates without auto-adding them.

**Tech Stack:** Bun, strict TypeScript, chezmoi, macOS Keychain `security`, OpenSSH, GnuPG, Mackup for one final uninstall, Bun test, GitHub Actions, ShellCheck.

**Spec:** `docs/superpowers/specs/2026-08-27-dotfiles-refactor-foundation-design.md`

## Prerequisites

Complete and verify:

- `docs/superpowers/plans/2026-08-31-bootstrap-setup-foundation.md`
- `docs/superpowers/plans/2026-08-31-state-sync-update.md`

This plan consumes the shared adapters, backup service, policy registry, normalizers, inventory providers, security validator, and setup task model from those plans.

## Global Constraints

- Scan only Mackup configuration/storage, top-level HOME candidates, `~/.config`, and an explicit high-value macOS Library allowlist. Never crawl all of HOME or Library.
- Every discovered target receives exactly one classification and rationale; an unclassified or duplicate target blocks migration.
- New files are report-only. No scanner or audit path may auto-add them to chezmoi or Git.
- Current live application files are canonical. iCloud/Mackup alternatives are archived with sanitized diff metadata.
- Require affected applications to be closed; stop with instructions and never force-quit them.
- Preserve existing SSH private keys and GPG private keyrings on this machine. Never sync private keys.
- Store five existing stable raw tokens in macOS Keychain, then remove their plaintext exports only after read-back verification. Preserve all non-secret `.zshlocal` content and optional `.gitlocal` overrides.
- Tool-native login/SSO is authoritative for volatile OAuth/session formats; do not copy them into Keychain or Git.
- Histories, conversations, sessions, telemetry, logs, caches, recent projects, locks, databases, backups, and machine identity remain excluded.
- Do not remove Mackup or its configuration until every ledger entry verifies and `mackup uninstall` succeeds. Retain iCloud Mackup storage as rollback material.
- Never print secret contents, private source names, or user-specific absolute paths in tracked reports.

---

## Task 1: Define the unified HOME-state ledger and bounded scanner

**Files:**
- Create: `src/home-state/types.ts`
- Create: `src/home-state/schema.ts`
- Create: `src/home-state/scanner.ts`
- Create: `src/home-state/mackup.ts`
- Create: `src/home-state/rules.ts`
- Create: `config/home-state.json`
- Create: `config/home-state-policy.json`
- Create: `tests/home-state/schema.test.ts`
- Create: `tests/home-state/scanner.test.ts`
- Create: `tests/fixtures/home-state/`

**Interfaces:** Consumes filesystem/platform adapters and Mackup config metadata. Produces the authoritative versioned ledger used by audit and the `home-state` setup task.

- [ ] Add failing tests for all four classifications, duplicate source/destination rejection, unclassified blocking, secret-safe serialization, bounded traversal, Mackup custom-config parsing, iCloud conflict-copy separation, and deterministic ordering.
- [ ] Define ledger types with no optional classification.

```ts
export type HomeStateClassification = "git" | "keychain" | "regenerate" | "exclude";
export type Sensitivity = "public" | "private" | "secret" | "machine";

export interface HomeStateEntry {
  readonly id: string;
  readonly source: string;
  readonly destination: string;
  readonly owner: string;
  readonly sensitivity: Sensitivity;
  readonly format: string;
  readonly platforms: readonly OperatingSystem[];
  readonly classification: HomeStateClassification;
  readonly action: string;
  readonly normalizer: string | null;
  readonly verification: { readonly kind: string; readonly value: string };
  readonly rationale: string;
}

export interface HomeStateLedger {
  readonly version: 1;
  readonly entries: readonly HomeStateEntry[];
}
```

- [ ] Implement a strict schema parser that rejects unknown keys, absolute tracked paths, `..`, duplicate IDs/sources/destinations, missing rationale/verification, `git` entries marked secret, and `keychain` entries without a Keychain service identifier.
- [ ] Implement bounded scanner roots:
  - Mackup's configured iCloud storage plus every application/custom config named by `shell/.mackup.cfg` and `shell/.mackup/*.cfg`.
  - Existing top-level candidates `CLAUDE.md`, `biome.json`, `.gitlocal`, `.zshlocal`, `.ssh`, `.gnupg`, and declared tool configuration directories.
  - Direct children and registered descendants of `~/.config`, never unrestricted recursion.
  - Registered high-value paths below `~/Library/Application Support` and `~/Library/Preferences` for installed applications only.
- [ ] Parse Mackup built-in application metadata through `mackup show <application>` when available. Cache only normalized path names in memory; fall back to explicit fixture metadata in tests. Treat each conflict/duplicate file as its own candidate.
- [ ] Seed exact classification rules in `config/home-state-policy.json`:
  - `git`: authored shell/Git/editor/terminal/tool settings, keybindings, snippets, public AI instructions/settings/plugin manifests, Docker daemon settings, `CLAUDE.md`, `biome.json`, Ghostty, Git, htop, Midnight Commander, Micro, Yazi, Zed, AI Completion, mactop, and canonical OpenLogi `config.toml`.
  - `keychain`: the five `.zshlocal` tokens and stable raw credential files only when a command has an implemented on-demand Keychain adapter.
  - `regenerate`: installed extensions/plugins, package caches, public key generation workflow, tool-native login/SSO state, and supported macOS preference tasks.
  - `exclude`: all histories/sessions/transcripts/logs/telemetry/caches/recent paths/locks/databases/backups/machine IDs; SSH/GPG private key material; `.netrc` content without an adapter; AWS/OAuth/auth JSON; whole plists; private registries/sources; CHIRP entirely; OpenLogi locks/backups.
- [ ] Generate and review `config/home-state.json` from the current machine. Store only HOME-relative standard paths and public application identifiers. If a discovered path name itself is private, represent it as `@local/private-paths/<opaque-id>` in the versioned ledger and resolve that ID from unmanaged local policy; commit the classification/rationale, never the private name.
- [ ] Assert every path represented by Mackup, its iCloud storage, the approved top-level list, approved `.config` applications, and Library allowlist has exactly one ledger entry. Zero unclassified is mandatory.
- [ ] Run `bun test tests/home-state/schema.test.ts tests/home-state/scanner.test.ts && bun run typecheck`; run the scanner twice and confirm byte-identical ledger output.
- [ ] Commit: `git add src/home-state config/home-state.json config/home-state-policy.json tests/home-state tests/fixtures/home-state && git commit -m "feat: classify managed home state"`

## Task 2: Implement read-only `dotfiles audit`

**Files:**
- Create: `src/audit/types.ts`
- Create: `src/audit/service.ts`
- Create: `src/commands/audit.ts`
- Modify: `src/cli/main.ts`
- Create: `tests/audit/service.test.ts`
- Create: `tests/commands/audit.test.ts`

**Interfaces:** Consumes ledger, scanner, chezmoi, policy, inventory, and Git services. Produces a read-only drift/candidate report and machine-readable JSON.

- [ ] Add failing tests for unmanaged candidates, managed drift, broken symlinks, unsafe permissions, unknown mutable schema, inventory additions/removals, missing ledger entries, JSON output stability, and zero writes/process mutations.
- [ ] Define findings with stable severity and codes.

```ts
export interface AuditFinding {
  readonly code: string;
  readonly severity: "info" | "warning" | "error";
  readonly path?: string;
  readonly message: string;
  readonly remediation?: string;
}

export interface AuditReport {
  readonly version: 1;
  readonly platform: OperatingSystem;
  readonly findings: readonly AuditFinding[];
}
```

- [ ] Implement `AuditService.run()` without mutation-capable dependencies. Compare scanner output to ledger, HOME targets to rendered chezmoi state, live inventories to public desired inventories, and source candidates to policy.
- [ ] Report new candidates but never classify/add them automatically. Report inventory removals as review-only and never synthesize uninstall commands.
- [ ] Redact HOME to `~`, Keychain identifiers to registered service IDs, and private local-policy values entirely. Do not hash secret contents for display.
- [ ] Add `dotfiles audit [--json] [--strict]`: default exits zero for informational/warning findings and non-zero for errors; `--strict` also fails on warnings.
- [ ] Run `bun test tests/audit tests/commands/audit.test.ts && bun run typecheck`; assert repository and temporary HOME hashes are unchanged after every audit test.
- [ ] Commit: `git add src/audit src/commands/audit.ts src/cli/main.ts tests/audit tests/commands/audit.test.ts && git commit -m "feat: audit unmanaged and drifting home state"`

## Task 3: Move stable raw tokens from `.zshlocal` to macOS Keychain

**Files:**
- Create: `src/secrets/keychain.ts`
- Create: `src/secrets/zshlocal.ts`
- Create: `src/secrets/command-env.ts`
- Create: `src/setup/tasks/secrets.ts`
- Create: `src/commands/internal-secret-exec.ts`
- Modify: `src/update/targets/homebrew.ts`
- Modify: `src/update/targets/bun.ts`
- Modify: `src/setup/catalog.ts`
- Create: `tests/secrets/keychain.test.ts`
- Create: `tests/secrets/zshlocal.test.ts`
- Create: `tests/setup/secrets-task.test.ts`

**Interfaces:** Consumes process/filesystem/backup adapters. Produces on-demand secret retrieval and the `secrets` setup task; raw values never enter command arguments visible in logs.

- [ ] Add failing tests for exact token-name parsing, preservation of comments/order/non-secret lines, backup-before-rewrite, existing-Keychain-value preservation, differing-value conflict, read-back verification, Linux no-mutation behavior, and complete redaction.
- [ ] Register exactly these environment names and Keychain services:

```ts
export const TOKEN_SERVICES = {
  HOMEBREW_GITHUB_API_TOKEN: "dotfiles/HOMEBREW_GITHUB_API_TOKEN",
  NPM_TOKEN: "dotfiles/NPM_TOKEN",
  JIRA_PERSONAL_TOKEN: "dotfiles/JIRA_PERSONAL_TOKEN",
  CONFLUENCE_PERSONAL_TOKEN: "dotfiles/CONFLUENCE_PERSONAL_TOKEN",
  BITBUCKET_HTTP_TOKEN: "dotfiles/BITBUCKET_HTTP_TOKEN",
} as const;
```

- [ ] Implement `MacOSKeychain` with `security find-generic-password` and `security add-generic-password`. Pass the write value as one argument marked by `sensitiveArgs`, never through a shell; redact it from logs/errors. Existing values win: if an item exists, leave it untouched; if plaintext differs, block removal and prompt the user to reconcile manually.
- [ ] Parse only literal `export NAME=...` assignments for the registered names. Do not source or evaluate `.zshlocal`. Preserve `PROJECT_PATHS`, `ECENTRIA_USER`, `BITBUCKET_USERNAME`, PATH customization, `LANDO_SSH_AUTH_SOCK`, comments, and all unknown lines byte-for-byte.
- [ ] Back up `.zshlocal`, write/verify every missing Keychain item, read each item back, then atomically remove only the verified token lines. Mode remains `0600` or is tightened from a broader mode.
- [ ] Add hidden `dotfiles internal secret exec <registered-name...> -- <command> [args...]` that injects registered values into one child environment without printing them, plus `withSecretEnvironment(names, operation)` for in-process use. Inject Homebrew/NPM tokens only around their corresponding update subprocesses, then discard the scoped environment. JIRA, Confluence, and Bitbucket tokens remain available only through explicit scoped execution until a repository command consumes them; do not globally export in shell startup.
- [ ] On Ubuntu/Debian, report the five variables as local-only unresolved secrets without importing them; setup remains usable for tasks that do not require them.
- [ ] Run `bun test tests/secrets tests/setup/secrets-task.test.ts && bun run typecheck`; search captured logs/output for every synthetic value and confirm zero matches.
- [ ] Commit: `git add src/secrets src/setup/tasks/secrets.ts src/setup/catalog.ts src/commands/internal-secret-exec.ts src/cli/main.ts src/update/targets/homebrew.ts src/update/targets/bun.ts tests/secrets tests/setup/secrets-task.test.ts && git commit -m "feat: migrate stable tokens to keychain"`

## Task 4: Preserve SSH/GPG identity and manage only safe metadata

**Files:**
- Create: `src/setup/tasks/ssh.ts`
- Create: `src/setup/tasks/gpg.ts`
- Create: `src/identity/ssh.ts`
- Create: `src/identity/gpg.ts`
- Create: `home/dot_ssh/config`
- Create: `home/dot_gnupg/gpg.conf`
- Create: `home/dot_gnupg/gpg-agent.conf`
- Create: `home/dot_config/dotfiles/identity/README.md`
- Create: `tests/identity/ssh.test.ts`
- Create: `tests/identity/gpg.test.ts`
- Create: `tests/setup/identity-tasks.test.ts`

**Interfaces:** Consumes setup/backups/chezmoi adapters. Produces safe identity tasks and public/exported metadata without private-key synchronization.

- [ ] Add failing tests proving existing private keys/keyrings are never moved, overwritten, copied into `home/`, logged, or staged; config conflicts are backed up; new-machine SSH generation is unique and local.
- [ ] Detect SSH private material by file mode plus PEM/OpenSSH headers without retaining content. Classify private keys, agent state, `known_hosts`, sockets, and control masters as excluded. Manage only reviewed `~/.ssh/config` directives and public `.pub` metadata approved in the ledger.
- [ ] On this machine, preserve all existing SSH keys in place and record only non-secret verification fingerprints in the private backup manifest. Do not regenerate or rotate them.
- [ ] On a new machine with no suitable key, offer a setup task that runs `ssh-keygen` locally with a unique filename and user-confirmed algorithm/comment. Never add the private path to chezmoi or Git.
- [ ] Manage `gpg.conf` and `gpg-agent.conf`; export public keys and ownertrust only to registered public/controlled source files. Exclude `private-keys-v1.d`, keybox/trust databases, random seed, sockets, revocation material, and caches.
- [ ] Before any SSH/GPG config apply, back up conflicting configs but not private key material. Verify private-key file identities/inodes and fingerprints are unchanged afterward.
- [ ] Run `bun test tests/identity tests/setup/identity-tasks.test.ts && bun run typecheck`; run repository validation and confirm no private-key fixture can stage.
- [ ] Commit: `git add src/identity src/setup/tasks/ssh.ts src/setup/tasks/gpg.ts src/setup/catalog.ts home/dot_ssh home/dot_gnupg home/dot_config/dotfiles/identity tests/identity tests/setup/identity-tasks.test.ts && git commit -m "feat: manage identity configuration without private keys"`

## Task 5: Execute the approved Mackup and HOME migration

**Files:**
- Create: `src/home-state/migrator.ts`
- Create: `src/home-state/verifier.ts`
- Create: `src/setup/tasks/home-state.ts`
- Modify: `src/setup/catalog.ts`
- Add: ledger-approved files under `home/`
- Modify: `config/sync-policy.json`
- Modify: `config/home-state.json`
- Delete after verification: `shell/.mackup.cfg`
- Delete after verification: `shell/.mackup/*.cfg`
- Create: `tests/home-state/migrator.test.ts`
- Create: `tests/integration/home-state-migration.test.ts`

**Interfaces:** Consumes the zero-unclassified ledger, normalizers, backup service, Keychain/identity adapters, chezmoi, and Mackup CLI. Produces regular managed files and a verified Mackup retirement.

- [ ] Add failing tests for application-close blocking, live-file canonical choice, alternate archival, git/keychain/regenerate/exclude dispatch, conflict backup, interrupted rerun, complete verification, and refusal to uninstall Mackup with any unresolved ledger entry.
- [ ] Implement an application-process registry for only affected ledger owners. `home-state` preflight reports exact applications the user must close and stops; it never calls `kill`, `pkill`, AppleScript quit, or force-quit.
- [ ] For each `git` entry, read the current live destination as canonical, archive differing Mackup/iCloud alternatives with a content hash and sanitized diff summary, run the registered normalizer, add its source path to `home/`, update sync policy, and apply through chezmoi as a regular file.
- [ ] For `keychain`, invoke the registered secret adapter and verify no plaintext remains in the managed/Mackup candidate. For `regenerate`, run or verify the declared setup/inventory provider. For `exclude`, verify the path is absent from `home/`, sync policy, inventories, and staged Git.
- [ ] Enforce special cases: OpenLogi manages the complete canonical `config.toml` and preserves device IDs; its lock/backups are excluded. CHIRP config and radio images are excluded entirely. macOS plist intent becomes typed reversible setup tasks; no whole plist enters `home/`.
- [ ] Preserve `.gitlocal` as an unmanaged optional override after public name/email defaults migrate. Preserve the non-secret remainder of `.zshlocal` unmanaged after Task 3.
- [ ] After all entries apply, verify destination existence/type/mode/content policy, zero chezmoi drift, zero ledger gaps, zero secret findings, and unchanged SSH/GPG private material.
- [ ] Only after successful verification run `mackup uninstall` in the normal supported mode. Re-run verification, retain the iCloud Mackup directory untouched as rollback material, then delete repository `shell/.mackup.cfg` and `shell/.mackup/*.cfg` and remove Mackup from the managed Brewfile/inventory.
- [ ] Integration-test migration from a fixture HOME containing Mackup symlinks, conflicting iCloud copies, excluded auth/session files, SSH keys, and an interruption after half the entries; rerun converges and preserves all excluded/private bytes.
- [ ] Run `bun test tests/home-state tests/integration/home-state-migration.test.ts && bun run typecheck`; run `dotfiles audit --strict` against the fixture and require zero findings.
- [ ] Stage `src/home-state`, the setup task/catalog, the two exact policy files, Mackup deletions, tests, and only the exact `home/` paths printed by the verified migrator; inspect the staged list before committing.
- [ ] Commit: `git commit -m "feat: migrate mackup and approved home state"`

## Task 6: Complete backup inspection, restoration, and explicit pruning

**Files:**
- Create: `src/commands/backups.ts`
- Modify: `src/backups/service.ts`
- Modify: `src/cli/main.ts`
- Create: `tests/commands/backups.test.ts`
- Create: `tests/backups/recovery.test.ts`

**Interfaces:** Consumes Plan 1 backup manifests. Produces `dotfiles backups list|restore|prune` with no implicit deletion.

- [ ] Add failing tests for malformed manifests, containment attacks, list ordering, collision refusal, selective/full restore, dry-run output, explicit prune confirmation, retained latest archives, and non-interactive refusal without exact archive IDs.
- [ ] Implement `backups list [--json]` showing ID/time/reasons/entry count/size without reading or displaying secret file contents.
- [ ] Implement `backups restore <archive> [--path <home-relative>] [--force] [--dry-run]`. Validate manifest/schema/containment and backup file hash before mutation; default refuses existing destinations. `--force` creates a new pre-restore backup first.
- [ ] Implement `backups prune <archive...> [--dry-run]`. Interactive mode displays exact paths and requires confirmation; non-interactive mode requires explicit archive IDs. Never support `--all`, age-based automatic deletion, globs, or background pruning.
- [ ] Delete only validated archive directories beneath the exact backup root; reject symlinked archives and paths outside it. Report that pruning is irreversible.
- [ ] Run `bun test tests/backups tests/commands/backups.test.ts && bun run typecheck`; confirm pass.
- [ ] Commit: `git add src/backups/service.ts src/commands/backups.ts src/cli/main.ts tests/backups tests/commands/backups.test.ts && git commit -m "feat: add explicit backup recovery commands"`

## Task 7: Implement actionable `dotfiles doctor`

**Files:**
- Create: `src/doctor/types.ts`
- Create: `src/doctor/service.ts`
- Create: `src/doctor/checks/platform.ts`
- Create: `src/doctor/checks/dependencies.ts`
- Create: `src/doctor/checks/chezmoi.ts`
- Create: `src/doctor/checks/git.ts`
- Create: `src/doctor/checks/secrets.ts`
- Create: `src/doctor/checks/home-state.ts`
- Create: `src/commands/doctor.ts`
- Modify: `src/cli/main.ts`
- Create: `tests/doctor/service.test.ts`
- Create: `tests/commands/doctor.test.ts`

**Interfaces:** Consumes read-only views of platform, process, Git, chezmoi, Keychain, ledger, backups, and policy. Produces human/JSON diagnostics.

- [ ] Add failing tests for supported platform/architecture, Bun/chezmoi/Git/Homebrew availability, source/config correctness, template validation, hooks, HTTPS remote/auth, Keychain references, ledger completeness, backup permissions, stale chezmoi state, and secret-safe output.
- [ ] Define check results with stable IDs and remediation commands.

```ts
export interface DoctorCheck {
  readonly id: string;
  run(dependencies: CliDependencies): Promise<CheckResult>;
}

export interface DoctorResult {
  readonly id: string;
  readonly status: "pass" | "warn" | "fail";
  readonly detail: string;
  readonly remediation?: string;
}
```

- [ ] Execute independent read-only checks even after failures and print one deterministic summary. Exit 1 on any failure, 0 for warnings only, and 2 only for an internal diagnostic error.
- [ ] Report stale `~/.local/share/chezmoi` but never remove it. Report missing GitHub push authentication with `gh auth login` and `gh auth setup-git` remediation.
- [ ] Secret checks verify item presence/readability by registered service ID without printing value, length, hash, or account beyond the configured non-secret identifier.
- [ ] Add `dotfiles doctor [--json] [--verbose]`; verbose may include sanitized command paths/versions, never environment dumps.
- [ ] Run `bun test tests/doctor tests/commands/doctor.test.ts && bun run typecheck`; confirm pass.
- [ ] Commit: `git add src/doctor src/commands/doctor.ts src/cli/main.ts tests/doctor tests/commands/doctor.test.ts && git commit -m "feat: diagnose dotfiles environment"`

## Task 8: Add macOS and Ubuntu CI safety gates

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/published-bootstrap.yml`
- Create: `tests/ci/prepare-home.ts`
- Create: `tests/integration/install-idempotence.test.ts`
- Create: `tests/integration/hooks.test.ts`
- Modify: `package.json`

**Interfaces:** Runs the checked-out installer and full validation suite in isolated HOME directories; separately probes the published `HEAD` bootstrap.

- [ ] Add package scripts `test:unit`, `test:integration`, `test:security`, and `ci`; keep each command executable locally without GitHub-specific environment assumptions.
- [ ] Build `tests/ci/prepare-home.ts` to create a temporary HOME, clone/copy the checked-out repository to `<temp>/.dotfiles`, set the expected HTTPS origin, and emit environment values through stdout without modifying the runner's real HOME.
- [ ] Create `ci.yml` on `pull_request` and `push` with `ubuntu-latest` and `macos-latest`. Use checkout and setup-bun, install locked dependencies with `bun install --frozen-lockfile`, install chezmoi, and run:

```sh
bun run typecheck
bun run test:unit
bun run test:security
shellcheck install.sh
bash -n install.sh
bun run test:integration
```

- [ ] In both jobs, run the checked-out `install.sh --non-interactive --select core-tools,shell,git --skip homebrew-packages --dry-run` against the isolated HOME, then run the safe apply path twice. Assert second-run source/HOME hashes are unchanged.
- [ ] Keep macOS GUI applications/system preferences and all OS update targets in dry-run. Do not run full package or OS mutation per commit.
- [ ] Add hook integration tests using a temporary bare remote; prove pre-commit and pre-push reject every secret/path/type fixture before any remote object becomes reachable from the branch.
- [ ] Create `published-bootstrap.yml` for weekly schedule plus `workflow_dispatch`. It downloads the exact documented public `HEAD` URL into a fresh runner HOME and runs only the non-interactive core dry-run/safe apply smoke test. It is separate from PR CI so forks cannot redefine the downloaded script.
- [ ] Add a manually dispatched `package-smoke` job guarded by workflow input for broader Homebrew/default-inventory installation; never include OS updates or greedy casks.
- [ ] Run the complete `bun run ci` locally. Validate both workflow files with an available YAML/action linter and inspect permissions; grant only `contents: read`.
- [ ] Commit: `git add .github/workflows tests/ci tests/integration/install-idempotence.test.ts tests/integration/hooks.test.ts package.json bun.lock && git commit -m "ci: verify isolated cross-platform setup"`

## Task 9: Finalize operations, migration evidence, and deprecation state

**Files:**
- Modify: `README.md`
- Modify: `docs/setup.md`
- Modify: `docs/recovery.md`
- Modify: `docs/sync.md`
- Create: `docs/home-state.md`
- Create: `docs/security.md`
- Create: `docs/migration-report.md`
- Modify: `setup/*.sh` headers only

**Interfaces:** Documents the final operational contract and records sanitized migration evidence; no legacy setup script is deleted in this plan.

- [ ] Document the CLI surface: `setup`, `apply`, `sync`, `update`, `audit`, `doctor`, `edit`, and `backups list|restore|prune`, including non-interactive flags and exit behavior.
- [ ] Document HOME classifications, how to propose a new managed target/normalizer, why new candidates are report-only, and special handling for `.zshlocal`, `.gitlocal`, SSH, GPG, OpenLogi, CHIRP, plists, AI sessions, and private sources.
- [ ] Document recovery from interrupted setup/sync/update, merge recovery, failed push, backup restore, retained iCloud Mackup rollback, and stale chezmoi source state.
- [ ] Generate `docs/migration-report.md` from ledger metadata only: counts by classification/platform/owner, every target ID and outcome, Mackup uninstall verification, and exclusions/rationales. No content hashes for secrets, local usernames, absolute paths, private source names, or timestamps tied to the machine.
- [ ] Add a deprecation header to each `setup/*.sh` naming its implemented replacement task or Stage 4 owner. Do not delete or execute legacy scripts from the new setup path.
- [ ] Run the final verification suite:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
shellcheck install.sh
bash -n install.sh
zsh -n home/dot_zshrc zsh/*.zsh
bin/dotfiles doctor
bin/dotfiles audit --strict
git diff --check
```

- [ ] Run the repository validator over the full candidate tree; manually inspect `git status --short` and the migration report. Confirm Mackup configuration is gone, iCloud rollback remains outside Git, all managed targets are regular files, and no unrelated HOME content is staged.
- [ ] Commit: `git add README.md docs setup && git commit -m "docs: finalize dotfiles migration operations"`

## Plan 3 Acceptance

- [ ] The current machine scan reports zero unclassified, duplicate, or unknown-schema targets across Mackup, approved HOME, `.config`, and selected Library paths.
- [ ] Every Mackup target is represented in the ledger and ends as verified `git`, `keychain`, `regenerate`, or `exclude`; no Mackup symlink remains active after uninstall.
- [ ] The iCloud Mackup directory remains intact and documented as rollback material; repository Mackup config is removed only after verification.
- [ ] `.zshlocal` retains all non-secret lines and no registered plaintext token exports; `.gitlocal` remains a valid optional unmanaged override.
- [ ] Existing SSH private keys and GPG private keyrings are byte/fingerprint-identical before and after migration; no private key is reachable from Git.
- [ ] `dotfiles audit` and `doctor` are read-only, secret-safe, deterministic, and actionable. Backup restore/prune reject traversal and require explicit targets.
- [ ] Checked-out installer/idempotence/security tests pass on current macOS and Ubuntu runners; published `HEAD` smoke test is independent and read-only beyond its isolated HOME.
- [ ] Record exact passing outputs and sanitized ledger counts in the implementation handoff. Stage 3 utility migration and Stage 4 legacy setup/preferences removal remain separate future plans.
