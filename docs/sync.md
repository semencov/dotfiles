# Managed-state synchronization

`dotfiles sync` imports approved live HOME changes into the chezmoi source, merges remote history normally, validates the candidate, creates at most one commit and optionally pushes once.

```sh
dotfiles sync
dotfiles sync --dry-run
dotfiles sync --no-push
dotfiles sync --message "sync: workstation config"
```

The command requires the canonical `~/.dotfiles` repository on `master`, the exact public HTTPS origin, `core.hooksPath=.githooks`, and a clean worktree/index. It never stashes, resets, cleans, rebases, force-pushes or rewrites history.

## Conflict policy

Before fetching, sync copies only registered regular live files into private temporary state and applies their registered normalizers. It then fetches `origin/master` and starts a normal `--no-ff --no-commit` merge when needed.

For conflicts limited to registered mutable sources, the remote side becomes the merge baseline and the initiating machine's pre-fetch live snapshot is reapplied. This is intentional last-sync-wins behavior: a stale machine syncing later can replace newer managed content, while both versions remain recoverable from Git history.

Any conflict outside the registered mutable-source allowlist stops the operation for manual review. An owned merge is aborted on handled failure.

## Managed boundaries

Only entries in `config/sync-policy.json` are imported. Unknown HOME files are ignored and never auto-added. Templates are edited in `home/` and are never reconstructed from rendered HOME output.

Mutable app files pass schema-aware normalizers. Unknown keys or schema changes block publication instead of being silently discarded. Inventory sources are deny-by-default: private registries, taps, internal namespaces, local URLs, authentication and machine-local paths cannot be published.

The complete staged candidate passes path, file type, size, template and secret validation before the commit. Repository hooks repeat the validation for direct Git/chezmoi workflows.

## Preview and recovery

`--dry-run` captures live state, fetches and reports normalized source changes without merging or writing source. `--no-push` creates the validated local commit but does not publish it.

Push failure returns non-zero but preserves the local commit:

```sh
cd ~/.dotfiles
git push origin HEAD:master
```

If the repository is dirty, inspect the paths reported by the CLI and either commit or deliberately resolve them before retrying. Sync never modifies unrelated work to make its precondition pass.
