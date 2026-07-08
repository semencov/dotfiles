# git-cleanup

> Remove stale and old synced Git branches and do other cleanup

- Dry run (print branches to remove, don’t actually remove them):

`git-cleanup`

- Run cleanup:

`git-cleanup --force`

Removes local branches whose upstream branch is gone, plus local branches older
than three months when the branch has an upstream and no local-only commits.
