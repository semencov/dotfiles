# Foundation Activation and Transition Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Stage 1 CLI understandable, activate chezmoi safely on the current machine, and remove the obsolete `shell/` compatibility layer after proving no live target depends on it.

**Architecture:** Add pure presentation/readiness boundaries around the existing setup and apply flows, verify them in isolated HOME fixtures, then execute the same tested activation against the real HOME with private evidence. Repository compatibility links are removed only after all managed HOME targets are regular files and a second apply is a no-op.

**Tech Stack:** Bun 1.4+, strict TypeScript, Commander, chezmoi 2.72+, Bun test, Bats, Zsh.

**Spec:** `docs/superpowers/specs/2026-09-02-repository-cleanup-design.md`

## Global Constraints

- `install.sh` remains Bash and the only pre-Bun program.
- Never reset, clean, stash, or overwrite repository changes.
- Never move, overwrite, generate, or publish SSH/GPG private material.
- HOME conflicts are archived through `BackupService` before chezmoi applies.
- Structured plan fields must be visible in console output, not only JSONL logs.
- Setup/apply do not commit or push repository changes.
- Delete `shell/` only after the current HOME and isolated fixture both prove no references remain.
- Use exact paths for deletion; do not use broad recursive cleanup against HOME or repository root.

---

## Task 1: Render actionable setup plans

**Files:**
- Create: `src/setup/presenter.ts`
- Modify: `src/setup/prompts.ts`
- Modify: `src/setup/types.ts`
- Create: `tests/setup/presenter.test.ts`
- Modify: `tests/setup/prompts.test.ts`
- Modify: `tests/setup/helpers.ts`

**Interfaces:**
- Consumes: `readonly SetupTask[]`, `SupportedPlatform`, and `dryRun: boolean`.
- Produces: `renderSetupPlan(tasks, platform, dryRun): string`.

- [ ] **Step 1: Write the failing presenter test**

```typescript
import { expect, test } from "bun:test";
import { renderSetupPlan } from "../../src/setup/presenter";
import { task } from "./helpers";

test("renders selected tasks with dependencies, risk, privilege, platform, and mode", () => {
  const output = renderSetupPlan([
    task("core-tools", { mutations: [] }),
    task("shell", {
      dependencies: ["homebrew-packages"],
      risk: "medium",
      privilege: "user",
      mutations: ["optionally change Linux login shell"],
    }),
  ], { os: "macos", arch: "arm64", homeDir: "/Users/test" }, true);

  expect(output).toContain("DRY RUN · macos/arm64");
  expect(output).toContain("core-tools");
  expect(output).toContain("shell");
  expect(output).toContain("homebrew-packages");
  expect(output).toContain("medium");
  expect(output).toContain("user");
});
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `bun test tests/setup/presenter.test.ts`

Expected: FAIL because `src/setup/presenter.ts` does not exist.

- [ ] **Step 3: Implement the pure renderer and expose proposed mutation metadata**

Add to `SetupTask`:

```typescript
readonly mutations: readonly string[];
```

Implement:

```typescript
export function renderSetupPlan(
  tasks: readonly SetupTask[],
  platform: SupportedPlatform,
  dryRun: boolean,
): string {
  const heading = `${dryRun ? "DRY RUN" : "SETUP"} · ${platform.os}/${platform.arch}`;
  const rows = tasks.map((task) => [
    task.id,
    task.dependencies.join(",") || "—",
    task.risk,
    task.privilege,
    task.mutations.join(", ") || "validation only",
  ]);
  return renderTextTable(heading, ["task", "depends", "risk", "privilege", "mutations"], rows);
}
```

Keep `renderTextTable` private and deterministic: compute column widths from Unicode string lengths, separate columns with two spaces, and end with one newline. Add exact `mutations` values to the four existing tasks:

```text
core-tools: validation only
homebrew-packages: install missing Homebrew/Brewfile packages
shell: optionally change Linux login shell
git: configure repository hooks and GitHub credentials
```

Add `mutations: []` to the default returned by `tests/setup/helpers.ts::task`.

Change `logPlan()` to send the rendered table as the log message. Keep structured task fields in the JSONL record as a second debug-level entry.

- [ ] **Step 4: Verify interactive and non-interactive plans expose identical task detail**

Extend `tests/setup/prompts.test.ts` with one interactive and one non-interactive case using the same resolved tasks. Assert both memory-log messages include the task IDs and mutation descriptions.

Run: `bun test tests/setup/presenter.test.ts tests/setup/prompts.test.ts && bun run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/setup/presenter.ts src/setup/prompts.ts src/setup/types.ts src/setup/tasks tests/setup/presenter.test.ts tests/setup/prompts.test.ts tests/setup/helpers.ts
git commit -m "fix: show complete setup plans"
```

## Task 2: Diagnose missing chezmoi activation before apply

**Files:**
- Create: `src/chezmoi/readiness.ts`
- Modify: `src/commands/apply.ts`
- Modify: `src/lib/errors.ts`
- Modify: `tests/commands/foundation.test.ts`
- Create: `tests/chezmoi/readiness.test.ts`
- Modify: `tests/support/fakes.ts`

**Interfaces:**
- Consumes: `configPath`, expected repository, and `FileSystem`.
- Produces: `assertChezmoiReady(options): Promise<void>` and `ChezmoiNotConfiguredError`.

- [ ] **Step 1: Add failing readiness tests**

```typescript
test("reports the setup command when machine configuration is absent", async () => {
  await expect(assertChezmoiReady({
    configPath: "/Users/test/.config/chezmoi/chezmoi.json",
    expectedRepo: "/Users/test/.dotfiles",
    fs: new FakeFileSystem(),
  })).rejects.toEqual(new ChezmoiNotConfiguredError("Run `dotfiles setup` first"));
});

test("rejects a config whose sourceDir is not the expected repository", async () => {
  const configPath = "/Users/test/.config/chezmoi/chezmoi.json";
  const expectedRepo = "/Users/test/.dotfiles";
  const fs = new FakeFileSystem({
    [configPath]: JSON.stringify({ sourceDir: "/tmp/unrelated" }),
  });
  await expect(assertChezmoiReady({ configPath, expectedRepo, fs }))
    .rejects.toThrow("does not use ~/.dotfiles");
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `bun test tests/chezmoi/readiness.test.ts tests/commands/foundation.test.ts`

Expected: FAIL because readiness is not checked before constructing chezmoi work.

- [ ] **Step 3: Implement strict readiness parsing**

`assertChezmoiReady` must:

1. Check that the JSON config exists.
2. Parse an object with `sourceDir: string`.
3. Resolve and compare `sourceDir` to the expected repo.
4. Reuse `validateSourceRepository` to require `.chezmoiroot` containing `home\n`.
5. Throw a public error containing `Run \`dotfiles setup\` first` for absent or incompatible config.

Call it at the start of `runApplyCommand`, before template verification or diff. Log the public remediation, not only the error type, and return `1`.

Extend `FakeFileSystem` with an optional `Readonly<Record<string, string>>` constructor seed used by `exists`, `readText`, and `realpath`; keep its default empty behavior unchanged for existing tests.

- [ ] **Step 4: Prove absent configuration causes zero process commands and mutations**

Add a `runApplyCommand` test with an empty fake filesystem. Assert exit `1`, no process commands, no backup archive, and console output containing `dotfiles setup`.

Run: `bun test tests/chezmoi/readiness.test.ts tests/commands/foundation.test.ts && bun run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/chezmoi/readiness.ts src/commands/apply.ts src/lib/errors.ts tests/chezmoi/readiness.test.ts tests/commands/foundation.test.ts tests/support/fakes.ts
git commit -m "fix: explain required chezmoi activation"
```

## Task 3: Prove activation without compatibility repository links

**Files:**
- Modify: `tests/integration/foundation-install.test.ts`
- Create: `tests/integration/fixtures/legacy-home-links.ts`

**Interfaces:**
- Consumes: Stage 1 installer, expected managed target fixture, and real chezmoi.
- Produces: an isolated migration proof in which legacy HOME symlinks become regular files without requiring `shell/` in the repository.

- [ ] **Step 1: Add a fixture helper that creates the old live topology**

```typescript
interface LegacyTarget {
  readonly target: string;
  readonly source: string;
}

export async function seedLegacyHomeLinks(
  home: string,
  repo: string,
  targets: readonly LegacyTarget[],
): Promise<void> {
  await mkdir(join(repo, "shell"), { recursive: true });
  for (const { target, source } of targets) {
    const legacySource = join(repo, "shell", target);
    await symlink(join("..", "home", source), legacySource);
    await symlink(join(".", ".dotfiles", "shell", target), join(home, target));
  }
}
```

The helper exists only inside the temporary fixture; it must not depend on tracked `shell/` paths.

- [ ] **Step 2: Replace the integration test's repository-link dependency**

Use `seedLegacyHomeLinks` to build the old two-hop topology inside the temporary repository copy. Stop copying the real tracked `shell/` directory into the fixture. Keep `tests/fixtures/expected-managed-targets.json` unchanged until Task 5 so the current source-state contract remains green.

- [ ] **Step 3: Run the focused test and confirm the old implementation fails**

Run: `bun test tests/integration/foundation-install.test.ts`

Expected: FAIL until the integration setup uses the synthetic legacy-link helper rather than the tracked compatibility directory.

- [ ] **Step 4: Extend integration assertions**

After the first isolated setup, assert every managed destination:

- is a regular file, not a symlink;
- matches `chezmoi cat` bytes;
- has one backup manifest entry for its seeded legacy symlink.

Run `dotfiles apply` twice and assert the second run creates no new backup directory and changes neither repository nor HOME hashes.

- [ ] **Step 5: Verify and commit the isolated migration proof**

Run: `bun test tests/integration/foundation-install.test.ts && bun run typecheck`

Expected: PASS. Do not remove `shell/` before the real-machine gate in Task 4.

```bash
git add tests/integration/foundation-install.test.ts tests/integration/fixtures/legacy-home-links.ts
git commit -m "test: decouple activation from compatibility links"
```

## Task 4: Activate chezmoi on the current machine

**Execution boundary:** Finish and merge the branch containing Tasks 1–3 into `master`, rerun their full verification on `master`, and remove that feature worktree. Task 4 must run from the clean canonical checkout at `~/.dotfiles`, not from an isolated worktree. After Task 4 passes, create a fresh feature worktree for Task 5.

**Files:**
- Runtime only: `~/.config/chezmoi/chezmoi.json`
- Runtime only: `~/.local/state/dotfiles/backups/<timestamp>/`
- Runtime only: managed targets listed in `tests/fixtures/expected-managed-targets.json`
- Runtime evidence: `~/.local/state/dotfiles/activation/2026-09-02/`

**Interfaces:**
- Consumes: the green Tasks 1–3 implementation, current checkout, and existing HOME.
- Produces: regular managed HOME files, a private conflict archive, and private before/after identity evidence.

- [ ] **Step 1: Require a clean expected checkout and capture private evidence**

Run these read-only checks and stop on any failure:

```bash
git status --porcelain -uall
git remote get-url origin
git rev-parse --show-toplevel
```

Expected: empty status, HTTPS origin `https://github.com/semencov/dotfiles.git`, and top-level `~/.dotfiles`.

Create the exact private evidence directory with mode `0700`. Record `lstat` type/mode and SHA-256 for `.zshlocal`, `.gitlocal`, regular files below `.ssh`, and regular files below `.gnupg`. Do not print file contents or include this evidence in Git. Hashing failure stops activation.

- [ ] **Step 2: Preview the actual plan**

Run:

```bash
dotfiles setup --non-interactive --select core-tools,git --skip homebrew-packages,shell --dry-run
```

Expected: exit `0`; visible plan includes `core-tools` and `git`, excludes package and shell mutation, and states that chezmoi HOME convergence will occur after selected tasks.

- [ ] **Step 3: Execute the bounded activation**

Run:

```bash
dotfiles setup --non-interactive --select core-tools,git --skip homebrew-packages,shell
```

Expected: exit `0`; any conflicting managed targets are archived before replacement. Do not run package upgrades or change login shell.

- [ ] **Step 4: Verify the activated state**

Run:

```bash
chezmoi source-path
dotfiles apply --dry-run
dotfiles apply
dotfiles apply
```

Expected: source resolves to `~/.dotfiles`; all three apply commands exit `0`; both real applies are no-ops; the second apply creates no backup archive.

For every target in the fixture, verify `lstat` reports a regular file and no path resolves through `~/.dotfiles/shell`. Verify `~/.config/chezmoi/chezmoi.json` and every backup manifest are `0600`; containing directories are `0700`.

- [ ] **Step 5: Verify protected local state is unchanged**

Capture the same `.zshlocal`, `.gitlocal`, `.ssh`, and `.gnupg` metadata/hashes and compare to Step 1. Any added, removed, changed, or mode-changed protected file blocks Task 5 and requires recovery from the activation archive.

Do not commit private evidence.

## Task 5: Remove the repository compatibility layer

**Files:**
- Delete: `shell/.Brewfile`
- Delete: `shell/.bash_profile`
- Delete: `shell/.editorconfig`
- Delete: `shell/.gitattributes`
- Delete: `shell/.gitconfig`
- Delete: `shell/.gitignore`
- Delete: `shell/.hushlogin`
- Delete: `shell/.inputrc`
- Delete: `shell/.mackup`
- Delete: `shell/.mackup.cfg`
- Delete: `shell/.ripgreprc`
- Delete: `shell/.starship.toml`
- Delete: `shell/.tldrrc`
- Delete: `shell/.zshrc`
- Modify: `tests/chezmoi/source-state.test.ts`
- Modify: `tests/fixtures/expected-managed-targets.json`
- Modify: `tests/integration/foundation-install.test.ts`
- Modify: `README.md`
- Modify: `docs/setup.md`
- Modify: `docs/recovery.md`

**Interfaces:**
- Consumes: successful real and isolated activation evidence.
- Produces: `home/` as the only tracked source for these HOME targets.

- [ ] **Step 1: Delete the exact compatibility directory**

First remove `legacy` and `compatibility` fields from every `tests/fixtures/expected-managed-targets.json` entry. Update the source-state test to require one `home/` source per target and require `shell/` to be absent; run it and confirm failure while `shell/` remains.

Then use `apply_patch` to delete the fourteen tracked entries listed above. Remove the now-empty `shell/` directory through Git naturally; do not run a recursive shell deletion.

- [ ] **Step 2: Make source-state tests authoritative**

The test must assert:

```typescript
for (const { target, source } of targets) {
  const metadata = await lstat(join(repository, "home", source));
  expect(metadata.isFile() || metadata.isDirectory()).toBe(true);
  expect(target.startsWith(".")).toBe(true);
}
await expect(lstat(join(repository, "shell"))).rejects.toMatchObject({ code: "ENOENT" });
```

Keep Mackup source files under `home/` until the separate HOME-state migration plan completes; this task removes only repository compatibility links.

- [ ] **Step 3: Update operational documentation**

State that existing machines must run `dotfiles setup` before updating to this commit, that the first apply archives legacy HOME symlinks, and that recovery uses the recorded backup manifest. Remove wording that calls `shell/` a supported compatibility surface.

- [ ] **Step 4: Run the complete gate**

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
bats tests/bootstrap/install.bats
shellcheck install.sh
bash -n install.sh
zsh -n home/dot_zshrc zsh/*.zsh
brew bundle list --file home/dot_Brewfile >/dev/null
git diff --check
```

Expected: all pass. Then run `dotfiles apply --dry-run` on the current machine and require an empty diff.

- [ ] **Step 5: Commit**

```bash
git add shell tests/chezmoi/source-state.test.ts tests/fixtures/expected-managed-targets.json tests/integration/foundation-install.test.ts README.md docs/setup.md docs/recovery.md
git commit -m "refactor: retire shell compatibility paths"
```

## Acceptance

- [ ] Real HOME managed targets are regular files and do not resolve through `shell/`.
- [ ] Existing `.zshlocal`, `.gitlocal`, SSH keys, and GPG keyrings are unchanged.
- [ ] The private machine config points chezmoi at `~/.dotfiles`.
- [ ] Setup dry-run shows the complete plan and proposed mutations.
- [ ] Apply without configuration gives an actionable setup command and performs no mutation.
- [ ] Isolated and real second applies are no-ops and create no backup.
- [ ] `shell/` is absent; `home/` remains the sole source for migrated foundation files.
- [ ] The full test, type, bootstrap, syntax, and Brewfile gates pass.
