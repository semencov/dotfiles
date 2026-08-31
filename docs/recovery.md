# Recovery

Setup never overwrites a conflicting managed target before archiving it. Archives live at:

```text
~/.local/state/dotfiles/backups/<UTC timestamp>/
```

Each archive mirrors paths relative to `$HOME` and contains a `manifest.json` recording source, archived path, type, mode, and reason. Archive directories are mode `0700`; manifests and generated machine configuration are mode `0600`. Multiple archives created in one second receive a numeric suffix.

Bootstrap checkout recovery uses the same root with directories named `bootstrap-<UTC timestamp>-<pid>/dotfiles`.

## Inspect

Stop any active setup process, then select the archive by its manifest rather than by guessing from timestamps:

```sh
ls -la ~/.local/state/dotfiles/backups
jq . ~/.local/state/dotfiles/backups/<archive>/manifest.json
dotfiles apply --dry-run
```

## Restore one entry

Move the current managed target aside, copy the archived entry back while preserving metadata, then decide whether the restored value belongs in chezmoi source or should remain machine-local:

```sh
mv ~/.gitconfig ~/.gitconfig.managed
cp -p ~/.local/state/dotfiles/backups/<archive>/.gitconfig ~/.gitconfig
```

For an archived symlink, recreate the link itself from the manifest/archive; do not copy the external file it pointed to. For a directory, restore only the required subtree rather than replacing a newer directory wholesale.

To return to managed state after extracting needed local values:

```sh
dotfiles apply --dry-run
dotfiles apply
```

Never restore `chezmoistate.boltdb` from a legacy migration archive over current state. A current state database is preserved on ordinary reruns; legacy state is archived only while replacing an old configuration layout.
