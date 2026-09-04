# Environment updates

`dotfiles update` converges the repository and managed HOME state, updates selected tools, captures public inventories and mutable configuration, validates the complete candidate, then creates one commit and optionally pushes it.

```sh
dotfiles update
dotfiles update --dry-run
dotfiles update --select homebrew,bun-globals --skip mas-apps
dotfiles update --non-interactive --no-push
```

Selections are saved under `data.dotfiles.selectedUpdates` in the local chezmoi configuration, independently of setup selections. `--select` adds targets, `--skip` wins over saved or selected targets, and dependencies are expanded in topological order. `--non-interactive` disables prompts; it cannot authorize high-risk targets.

## Lifecycle

The command uses the same single transaction coordinator as `dotfiles sync`:

1. Require the canonical repository, `master`, configured hooks and a clean worktree/index.
2. Capture and normalize allowlisted live files into private temporary state.
3. Fetch and normally merge `origin/master`, with the initiating machine's live snapshot winning managed-file conflicts.
4. Apply chezmoi.
5. Run selected update targets in dependency order.
6. Snapshot inventories only for successful or unchanged providers.
7. Re-capture normalized mutable configuration.
8. Stage and validate the complete candidate, create at most one commit, then push once.

Independent targets continue after a failure. Dependents of failed or unavailable targets are skipped. A failed target never bypasses repository validation; safe independent results may still be committed and pushed, while the final command remains non-zero.

`--dry-run` fetches and previews managed-state changes and prints the full target/dependency plan. It does not merge, apply, update tools, write inventories, commit or push. `--no-push` retains any valid commit locally.

## Targets

Default portable targets are `homebrew`, `bun-globals`, `uv-tools`, `editor-extensions`, `gh-extensions`, `ai-tools` and `config`. `mas-apps` is also default on macOS. Missing optional tools are reported as unavailable without blocking independent targets.

The following targets are always opt-in:

- `homebrew-greedy-casks`
- `macos-system-update`
- `debian-system-update`

System updates require an explicit interactive confirmation. Normal Homebrew updates are non-greedy. The updater never performs system-Python global upgrades or uses `--break-system-packages`.

Inventories contain public identifiers and sources only. They are install-only desired state: removing an entry never uninstalls software.

## Exit and recovery

- `0`: selected targets and publication completed.
- `1`: target, validation, merge or push failure; also used when a dependent target was skipped.
- `130`: interactive cancellation.

If push fails, the validated local commit is preserved. Retry without rerunning updates:

```sh
cd ~/.dotfiles
git push origin HEAD:master
```

Resolve a reported non-managed merge conflict manually, return the repository to a clean state, then rerun the command. The CLI never stashes, resets, force-pushes or rewrites published history.
