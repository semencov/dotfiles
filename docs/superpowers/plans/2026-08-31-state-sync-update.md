# State Sync and Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure batch synchronization, normalized mutable configuration, public install-only inventories, and dependency-aware environment updates behind `dotfiles sync` and `dotfiles update`.

**Architecture:** A repository-local policy registry is the single source of truth for importable targets, normalizers, inventories, and update targets. Sync captures live state before pulling, merges remote history without rewriting it, reapplies the initiating machine snapshot, validates the whole candidate tree, and publishes one batch commit. Update wraps that same sync boundary around independent dependency-ordered updater groups.

**Tech Stack:** Bun, strict TypeScript, Commander, chezmoi, Git, Homebrew, uv, GitHub CLI, editor CLIs, Mac App Store CLI, Bun test.

**Spec:** `docs/superpowers/specs/2026-08-27-dotfiles-refactor-foundation-design.md`

## Prerequisite

Complete and verify `docs/superpowers/plans/2026-08-31-bootstrap-setup-foundation.md`. This plan consumes its `CliDependencies`, `FileSystem`, `ProcessRunner`, `ChezmoiClient`, `BackupService`, setup command, and CLI entry point without redefining them.

## Global Constraints

- Sync only explicitly registered targets. Templates are source-edited and never re-added from rendered HOME files.
- Every mutable app-owned target has a schema-aware normalizer; unknown schema blocks publication.
- Keep chezmoi auto-commit/auto-push enabled globally, but disable both for each batch invocation.
- Require a clean repository before batch sync/update. Never silently stash, reset, clean, force-push, or rewrite published history.
- Resolve managed live-state conflicts with the initiating machine's pre-pull snapshot winning. Non-managed Git conflicts stop safely for review.
- Validate before commit and again before push. Secret fixtures must be synthetic and unmistakably non-live.
- Inventories contain approved public sources only and are install-only. Missing inventory entries do not uninstall anything.
- Setup installs missing tools only. Broad upgrades run only through `dotfiles update`.
- Update groups execute in dependency order; independent groups continue after failure; any failure yields a final non-zero exit.
- Do not depend on, invoke, modify, wrap, or copy `smcv-cli`; its target coverage was design input only.
- Delete `bin/update` and `bin/update.mjs` when the replacement is accepted. Do not add shims.

---

## Task 1: Create the repository publication policy and Git client

**Files:**
- Create: `src/git/client.ts`
- Create: `src/git/types.ts`
- Create: `src/policy/registry.ts`
- Create: `src/policy/types.ts`
- Create: `config/sync-policy.json`
- Create: `tests/git/client.test.ts`
- Create: `tests/policy/registry.test.ts`

**Interfaces:** Consumes process/filesystem adapters. Produces typed Git operations and the allowlist shared by sync, hooks, audit, and inventories.

- [ ] Add failing tests for repository/remote/branch validation, dirty-worktree rejection, ahead/behind state, staged-path enumeration, merge-conflict enumeration, and rejection of unknown or duplicate policy entries.
- [ ] Define the publication policy types.

```ts
export type ManagedClassification = "managed" | "inventory" | "generated";

export interface SyncPolicyEntry {
  readonly id: string;
  readonly target: string;
  readonly source: string;
  readonly platform: readonly OperatingSystem[];
  readonly classification: ManagedClassification;
  readonly normalizer?: string;
  readonly maxBytes: number;
  readonly allowedFormats: readonly ("text" | "json" | "toml" | "yaml")[];
}

export interface SyncPolicy {
  readonly version: 1;
  readonly repositoryPaths: readonly string[];
  readonly entries: readonly SyncPolicyEntry[];
}
```

- [ ] Seed `config/sync-policy.json` only with non-template files migrated in Plan 1 and empty inventory destinations introduced later in this plan. Set `repositoryPaths` to the reviewed infrastructure roots/files (`.github`, `.githooks`, `bin`, `config`, `docs`, `home`, `inventories`, `misc`, `setup`, `shell`, `src`, `tests`, `zsh`, and reviewed root files). Paths must be HOME-relative targets and repository-relative sources; reject absolute paths and traversal.
- [ ] Implement `PolicyRegistry.load()` with strict key validation, unique IDs/targets/sources, source containment, platform filtering, normalizer existence checks, and deterministic ordering.
- [ ] Implement `GitClient` methods `assertExpectedRepository`, `status`, `fetch`, `beginMergeWithoutCommit`, `conflicts`, `checkoutConflictSide`, `stage`, `commit`, `push`, `abortMerge`, `hooksPath`, and `head`. Use argument arrays and the exact public HTTPS remote.
- [ ] `beginMergeWithoutCommit` must use normal merge history: `git merge --no-ff --no-commit origin/<branch>`. If already up to date, it returns `"unchanged"`; it never rebases.
- [ ] Run `bun test tests/git tests/policy && bun run typecheck`; confirm pass.
- [ ] Commit: `git add src/git src/policy config/sync-policy.json tests/git tests/policy && git commit -m "feat: define managed state publication policy"`

## Task 2: Enforce secret and path safety in repository-local hooks

**Files:**
- Create: `src/security/validate-repository.ts`
- Create: `src/security/secret-rules.ts`
- Create: `src/security/file-rules.ts`
- Create: `src/commands/internal-validate.ts`
- Create: `.githooks/pre-commit`
- Create: `.githooks/pre-push`
- Create: `tests/security/validate-repository.test.ts`
- Create: `tests/fixtures/security/allowed/`
- Create: `tests/fixtures/security/rejected/`

**Interfaces:** Consumes `PolicyRegistry`, Git client, and chezmoi template validation. Produces the validation gate called directly by hooks, sync, update, and CI.

- [ ] Add failing tests for an allowlisted public config and rejection of: unknown managed path, AWS-style key, GitHub token, npm token, PEM private key, `.netrc` credentials, suspicious auth JSON, binary file, oversized file, invalid template, and path traversal.
- [ ] Implement structured secret rules for known prefixes plus entropy-aware suspicious assignments. Scan staged blobs from the Git index, not only working-tree files. Redact matches to rule ID/path/line; never print candidate secret bytes.
- [ ] Implement file checks from policy: permitted path, format, maximum bytes, UTF-8/text expectation, no symlink escaping the repository, and no special file type.
- [ ] Add `dotfiles internal validate --staged|--tree <ref>` as a hidden CLI command. It returns non-zero on any finding and prints deterministic remediation.
- [ ] Create `.githooks/pre-commit` and `.githooks/pre-push` as executable Bun entry points importing the hidden validator. Pre-commit validates the index; pre-push validates the commits being published plus templates and policy consistency.
- [ ] Ensure Plan 1 setup sets `core.hooksPath=.githooks` and fails verification when the path differs.
- [ ] Run `bun test tests/security && bun run typecheck`; manually seed each rejected fixture into a temporary Git index and confirm the hook blocks it.
- [ ] Commit: `git add src/security src/commands/internal-validate.ts src/cli/main.ts .githooks tests/security tests/fixtures/security && git commit -m "feat: guard dotfiles publication locally"`

## Task 3: Implement strict configuration normalizers

**Files:**
- Create: `src/normalizers/types.ts`
- Create: `src/normalizers/registry.ts`
- Create: `src/normalizers/json.ts`
- Create: `src/normalizers/toml.ts`
- Create: `src/normalizers/text.ts`
- Create: `src/normalizers/openlogi.ts`
- Create: `tests/normalizers/registry.test.ts`
- Create: `tests/normalizers/openlogi.test.ts`
- Create: `tests/fixtures/normalizers/`

**Interfaces:** Consumes a policy normalizer ID and live bytes. Produces canonical bytes or a blocking schema diagnostic used by sync.

- [ ] Add failing tests for deterministic key ordering/newlines, volatile-key removal, private-source filtering, malformed input rejection, unknown top-level key rejection, and OpenLogi's full-config exception.
- [ ] Define normalizer contracts with an explicit schema version.

```ts
export interface NormalizeContext {
  readonly target: string;
  readonly platform: OperatingSystem;
  readonly publicSourceAllowlist: ReadonlySet<string>;
}

export interface Normalizer {
  readonly id: string;
  readonly schemaVersion: number;
  normalize(input: Uint8Array, context: NormalizeContext): Promise<Uint8Array>;
}
```

- [ ] Implement canonical JSON with recursively sorted object keys and one trailing newline; TOML with registered accepted keys and deterministic section/key order; text with normalized LF and one trailing newline. Do not silently discard unknown keys unless that exact key is registered as volatile.
- [ ] Register target-specific policies for machine IDs, timestamps, caches, recent paths, local absolute paths, private package sources, and authentication fields. Encountering a new schema/key produces `UnknownSchemaError` with target and key path.
- [ ] Implement `openlogi-v1`: parse and validate the full expected TOML schema, preserve device IDs and all application-owned fields, exclude lock/backup siblings via policy, then serialize canonically.
- [ ] Add a round-trip property test: `normalize(normalize(input))` is byte-identical for every fixture.
- [ ] Run `bun test tests/normalizers && bun run typecheck`; confirm pass.
- [ ] Commit: `git add src/normalizers tests/normalizers tests/fixtures/normalizers && git commit -m "feat: normalize mutable managed configuration"`

## Task 4: Implement last-sync-wins batch synchronization

**Files:**
- Create: `src/sync/types.ts`
- Create: `src/sync/snapshot.ts`
- Create: `src/sync/service.ts`
- Create: `src/commands/sync.ts`
- Modify: `src/cli/main.ts`
- Create: `tests/sync/snapshot.test.ts`
- Create: `tests/sync/service.test.ts`
- Create: `tests/integration/sync-git.test.ts`

**Interfaces:** Consumes Git, policy, normalizers, chezmoi, backup, and filesystem services. Produces `dotfiles sync` and a reusable pre/post update state boundary.

- [ ] Add failing unit tests for exact lifecycle ordering, live snapshot privacy, automatic Git suppression, local snapshot overwrite after remote merge, one final content commit, push warning/error behavior, cleanup on success/error/SIGINT, and no mutation when preconditions fail.
- [ ] Define synchronization results.

```ts
export interface SyncOptions {
  readonly push: boolean;
  readonly dryRun: boolean;
  readonly message: string;
}

export interface SyncResult {
  readonly changedSources: readonly string[];
  readonly commit: string | null;
  readonly pushed: boolean;
  readonly warnings: readonly string[];
}
```

- [ ] Implement `LiveSnapshotService.capture(policy)` into a `0700` temporary directory under the private state root. Copy only allowlisted live targets, record content hashes/modes, never follow symlinks, and delete the snapshot on handled exit.
- [ ] Implement the exact sync transaction:
  1. Validate expected repository, hooks, policy, and clean worktree/index.
  2. Capture and normalize allowlisted live state before network operations.
  3. Fetch the configured upstream.
  4. Begin a no-rewrite merge with `--no-ff --no-commit` when remote history differs.
  5. If conflicts exist only in registered importable source files, take the remote side as a merge baseline; abort and report any other conflicted path.
  6. Apply the pre-pull local snapshot into chezmoi sources with Git auto-actions disabled, so local live content wins.
  7. Validate the complete candidate index/tree, stage exact changed sources, and create one batch commit (the same commit completes a pending merge).
  8. Push once when enabled; retain a valid local commit and return a warning when auth/network push fails.
- [ ] Import regular non-template targets through `chezmoi add --force` under invocation-local config with `git.autoCommit=false` and `git.autoPush=false`; for normalized app files, write canonical bytes to the registered source explicitly, then validate chezmoi diff.
- [ ] If a merge started and validation/import fails, call `git merge --abort` only after verifying `MERGE_HEAD` belongs to this operation; preserve the private snapshot and write its recovery path to the log.
- [ ] Implement `dotfiles sync [--no-push] [--dry-run] [--message <text>]`. Dry-run captures, fetches, and reports proposed normalized diffs but starts no merge and writes no source.
- [ ] Integration-test two bare-remoted clones: remote changes a managed source, clone A has different live state, A syncs, final history includes remote history and A's live bytes, with no force update.
- [ ] Run `bun test tests/sync tests/integration/sync-git.test.ts && bun run typecheck`; confirm pass.
- [ ] Commit: `git add src/sync src/commands/sync.ts src/cli/main.ts tests/sync tests/integration/sync-git.test.ts && git commit -m "feat: add normalized last-sync-wins workflow"`

## Task 5: Add public install-only inventory providers

**Files:**
- Create: `src/inventory/types.ts`
- Create: `src/inventory/service.ts`
- Create: `src/inventory/filter.ts`
- Create: `src/inventory/providers/homebrew.ts`
- Create: `src/inventory/providers/bun.ts`
- Create: `src/inventory/providers/uv.ts`
- Create: `src/inventory/providers/mas.ts`
- Create: `src/inventory/providers/editors.ts`
- Create: `src/inventory/providers/gh.ts`
- Create: `src/inventory/providers/ai.ts`
- Create: `inventories/*.json`
- Create: `tests/inventory/providers.test.ts`
- Create: `tests/inventory/filter.test.ts`

**Interfaces:** Produces canonical public inventory snapshots and missing-only installation plans consumed by setup/update/sync.

- [ ] Add failing provider tests using captured command output fixtures for Homebrew formulae/casks/taps, Bun globals, uv tools, MAS apps, VS Code/Cursor/Zed extensions, GitHub CLI extensions, and global AI skills/plugins.
- [ ] Define a provider boundary.

```ts
export interface InventoryItem {
  readonly id: string;
  readonly kind: string;
  readonly source?: string;
  readonly platform?: OperatingSystem;
}

export interface InventoryProvider {
  readonly id: string;
  supported(platform: SupportedPlatform): boolean;
  snapshot(context: CliDependencies): Promise<readonly InventoryItem[]>;
  planMissing(desired: readonly InventoryItem[], installed: readonly InventoryItem[]): readonly CommandSpec[];
}
```

- [ ] Serialize one versioned JSON file per provider with stable sorting and final newline. Include identifiers/sources/platform only—never versions, timestamps, local paths, auth, counters, or machine IDs.
- [ ] Build deny-by-default public-source filtering. Private taps, internal extension namespaces, private MCP/plugin registries, local file URLs, and company package names stay only in unmanaged local configuration. Unknown sources block snapshot publication.
- [ ] Convert the managed Brewfile to explicit `if OS.mac?` / `if OS.linux?` sections as needed while preserving currently declared packages. APT remains absent from inventories.
- [ ] Implement missing-only plans. Diff output may report removed desired entries, but no provider creates uninstall commands; removal requires a future explicit cleanup command.
- [ ] Add all inventory destinations to `config/sync-policy.json` as generated sources with correct platform and size limits.
- [ ] Run `bun test tests/inventory && bun run typecheck`; confirm pass.
- [ ] Commit: `git add src/inventory inventories home/dot_Brewfile config/sync-policy.json tests/inventory && git commit -m "feat: capture public tool inventories"`

## Task 6: Model dependency-aware update targets

**Files:**
- Create: `src/update/types.ts`
- Create: `src/update/graph.ts`
- Create: `src/update/runner.ts`
- Create: `src/update/catalog.ts`
- Create: `tests/update/graph.test.ts`
- Create: `tests/update/runner.test.ts`

**Interfaces:** Produces selected update plans and a failure-tolerant runner consumed by `dotfiles update`.

- [ ] Add failing tests for dependency expansion, platform filtering, saved/default/explicit selection, opt-in targets, failed dependency skipping, independent-group continuation, stable summary ordering, and final non-zero status.
- [ ] Define update target contracts separately from setup tasks.

```ts
export interface UpdateTarget {
  readonly id: string;
  readonly title: string;
  readonly platforms: readonly OperatingSystem[];
  readonly dependencies: readonly string[];
  readonly defaultSelected: boolean;
  readonly group: string;
  preflight(context: TaskContext): Promise<CheckResult>;
  update(context: TaskContext): Promise<void>;
  verify(context: TaskContext): Promise<CheckResult>;
}

export interface UpdateSummaryEntry {
  readonly id: string;
  readonly status: "updated" | "unchanged" | "failed" | "skipped-dependency" | "unavailable";
  readonly detail?: string;
}
```

- [ ] Reuse graph/selection primitives where semantics match, but keep update continuation rules explicit: execute groups sequentially; after a target fails, skip its dependents and continue targets with satisfied dependencies.
- [ ] Store update selections in the non-secret `data.dotfiles` machine configuration independently from setup selections.
- [ ] Print one final table and return exit code 1 if any entry is `failed` or `skipped-dependency`; cancellation returns 130.
- [ ] Run `bun test tests/update/graph.test.ts tests/update/runner.test.ts && bun run typecheck`; confirm pass.
- [ ] Commit: `git add src/update tests/update && git commit -m "feat: add dependency-aware update engine"`

## Task 7: Implement the update catalog and lifecycle

**Files:**
- Create: `src/update/targets/homebrew.ts`
- Create: `src/update/targets/bun.ts`
- Create: `src/update/targets/uv.ts`
- Create: `src/update/targets/mas.ts`
- Create: `src/update/targets/editors.ts`
- Create: `src/update/targets/gh.ts`
- Create: `src/update/targets/ai.ts`
- Create: `src/update/targets/os.ts`
- Create: `src/update/targets/config.ts`
- Create: `src/commands/update.ts`
- Modify: `src/commands/setup.ts`
- Modify: `src/cli/main.ts`
- Create: `tests/update/targets.test.ts`
- Create: `tests/integration/update-lifecycle.test.ts`

**Interfaces:** Consumes sync boundaries, inventory providers, and update runner. Produces the complete `dotfiles update` lifecycle and successful setup/update inventory snapshots.

- [ ] Add failing command-construction tests for every target on each supported platform. Explicitly assert no command contains `pip --break-system-packages`, system-Python global upgrades, greedy cask flags in the normal Homebrew target, or OS update flags in a default-selected target.
- [ ] Implement normal targets: Homebrew formulae/casks, Bun globals, uv tools, editor extensions, GitHub CLI extensions, MAS apps, AI skills/plugins, and config convergence.
- [ ] Implement `homebrew-greedy-casks` separately with `defaultSelected: false`. Implement `macos-system-update` and `debian-system-update` separately with `defaultSelected: false` and high-risk confirmation.
- [ ] Use provider-native commands and verify exit/status afterward. If a tool is unavailable and not selected as a dependency, mark target unavailable rather than failing unrelated groups.
- [ ] Implement exact `dotfiles update` lifecycle: capture live snapshot; merge/pull remote source with local-live conflict policy; apply chezmoi; execute selected update targets; snapshot inventories; re-import normalized configs; validate; create one final content commit; push once.
- [ ] Share one transaction coordinator with sync rather than invoking `dotfiles sync` twice. Preserve independent update results even when final push fails; push failure makes the command non-zero but leaves a recoverable local commit.
- [ ] After a fully successful `dotfiles setup`, snapshot the supported inventories and publish through the same validation/commit path. A failed setup never snapshots.
- [ ] Add `--non-interactive`, `--select`, `--skip`, `--dry-run`, and `--no-push`. Show the full target/dependency plan before mutation.
- [ ] Integration-test partial failure: Homebrew fails, independent editor update succeeds, dependent inventory step is skipped, final config capture runs where safe, summary is complete, exit is non-zero, and no invalid candidate is committed.
- [ ] Run `bun test tests/update tests/integration/update-lifecycle.test.ts && bun run typecheck`; confirm pass.
- [ ] Commit: `git add src/update src/commands/update.ts src/commands/setup.ts src/cli/main.ts tests/update tests/integration/update-lifecycle.test.ts && git commit -m "feat: orchestrate environment updates"`

## Task 8: Remove legacy update commands and document synchronization

**Files:**
- Delete: `bin/update`
- Delete: `bin/update.mjs`
- Modify: `docs/update.md`
- Create: `docs/sync.md`
- Modify: `README.md`
- Create: `tests/integration/publication-security.test.ts`

**Interfaces:** Finalizes the command migration without compatibility shims and proves the public-repository safety boundary.

- [ ] Add an integration test that exercises `sync --no-push` and `update --no-push` in a temporary repository with every synthetic secret fixture; assert the hook rejects publication and no raw secret appears in stdout, stderr, or durable logs.
- [ ] Add an integration test proving unknown live HOME files are ignored and reported by neither sync import nor inventory capture.
- [ ] Delete `bin/update` and `bin/update.mjs`. Confirm no alias, documentation, or command dispatcher still references them. Do not create a wrapper or shim.
- [ ] Rewrite `docs/update.md` for `dotfiles update`: lifecycle, default and opt-in targets, continuation semantics, inventory policy, local-commit recovery, and exit codes.
- [ ] Document `dotfiles sync`: clean-repository precondition, local-live last-sync-wins behavior, template editing, normalizer blocking, public-source filtering, and push-auth recovery.
- [ ] Update README command summary and explicitly state that inventories never uninstall software.
- [ ] Run `bun test && bun run typecheck && shellcheck install.sh && bash -n install.sh && zsh -n home/dot_zshrc zsh/*.zsh`.
- [ ] Run `git diff --check`, inspect staged blobs with the new validator, and confirm `git status --short` contains no unrelated files.
- [ ] Commit: `git add bin/update bin/update.mjs README.md docs/update.md docs/sync.md tests/integration/publication-security.test.ts && git commit -m "refactor: replace legacy update commands"`

## Plan 2 Acceptance

- [ ] In two temporary clones sharing a bare remote, verify stale clone live state wins when it deliberately syncs later, while previous remote state remains recoverable from Git history.
- [ ] Verify sync creates at most one new batch commit after remote convergence and never force-updates a branch.
- [ ] Verify direct chezmoi edits still auto-commit/auto-push through the same hooks; batch operations suppress automatic actions and push once.
- [ ] Run every rejected security fixture through pre-commit and pre-push; confirm secrets, unknown paths, invalid templates, binaries, and oversize files cannot publish.
- [ ] Verify update continues independent groups, skips dependents, snapshots only successful providers, and exits non-zero with one complete summary.
- [ ] Verify normal Homebrew updates are non-greedy, OS updates are unselected, and no system-Python break-glass flag exists anywhere in tracked source.
- [ ] Record the exact passing command output in the implementation handoff; proceed to Plan 3 only after all checks pass.
