#!/usr/bin/env bats

load helpers

setup() {
  setup_bootstrap_test
}

teardown() {
  teardown_bootstrap_test
}

@test "accepts supported macOS and Linux architecture pairs" {
  run_installer --non-interactive --dry-run
  [ "$status" -eq 0 ]

  rm -rf "$HOME/.dotfiles"
  export FAKE_UNAME_S=Linux
  export FAKE_UNAME_M=x86_64
  run_installer --non-interactive --dry-run
  [ "$status" -eq 0 ]

  rm -rf "$HOME/.dotfiles"
  export FAKE_UNAME_M=aarch64
  export DOTFILES_OS_RELEASE_FILE="$BATS_TEST_DIRNAME/../fixtures/os-release/debian"
  run_installer --non-interactive --dry-run
  [ "$status" -eq 0 ]
}

@test "rejects unsupported platforms before downloads or filesystem mutation" {
  export FAKE_UNAME_S=FreeBSD

  run_installer --non-interactive

  [ "$status" -ne 0 ]
  [ ! -e "$HOME/.dotfiles" ]
  [ ! -s "$BOOTSTRAP_LOG" ]
}

@test "rejects root before mutation" {
  export DOTFILES_TEST_EUID=0

  run_installer --non-interactive

  [ "$status" -ne 0 ]
  [ ! -e "$HOME/.dotfiles" ]
  [ ! -s "$BOOTSTRAP_LOG" ]
}

@test "requires a TTY unless non-interactive is explicit" {
  run_installer

  [ "$status" -ne 0 ]
  [[ "$output" == *"--non-interactive"* ]]
  [ ! -e "$HOME/.dotfiles" ]
}

@test "preserves an existing correct dirty checkout" {
  create_expected_checkout
  printf '%s\n' dirty >"$HOME/.dotfiles/local-change"

  run_installer --non-interactive --dry-run

  [ "$status" -eq 0 ]
  [ "$(<"$HOME/.dotfiles/local-change")" = dirty ]
  ! find "$HOME/.local/state/dotfiles/backups" -type f -name local-change 2>/dev/null | grep -q .
}

@test "backs up an unrelated checkout before cloning" {
  mkdir -p "$HOME/.dotfiles"
  printf '%s\n' preserve >"$HOME/.dotfiles/unrelated"

  run_installer --non-interactive --dry-run

  [ "$status" -eq 0 ]
  backup="$(find "$HOME/.local/state/dotfiles/backups" -type f -name unrelated -print -quit)"
  [ -n "$backup" ]
  [ "$(<"$backup")" = preserve ]
}

@test "clones only from the canonical HTTPS remote" {
  run_installer --non-interactive --dry-run

  [ "$status" -eq 0 ]
  grep -Fq "git-clone=https://github.com/semencov/dotfiles.git|$HOME/.dotfiles" "$BOOTSTRAP_LOG"
}

@test "propagates official installer download failures" {
  rm "$FAKE_BIN/chezmoi"
  cat >"$FAKE_BIN/curl" <<'EOF'
#!/bin/bash
printf '%s\n' curl-failed >>"$BOOTSTRAP_LOG"
exit 22
EOF
  chmod +x "$FAKE_BIN/curl"

  run_installer --non-interactive

  [ "$status" -eq 22 ]
  [ ! -e "$HOME/.dotfiles" ]
}

@test "installs missing runtimes from official HTTPS endpoints and re-resolves PATH" {
  rm "$FAKE_BIN/chezmoi" "$FAKE_BIN/bun"
  create_fake_installer_curl

  run_installer --non-interactive --dry-run

  [ "$status" -eq 0 ]
  [ -x "$HOME/.local/bin/chezmoi" ]
  [ -x "$HOME/.bun/bin/bun" ]
  grep -Fxq 'download=https://get.chezmoi.io' "$BOOTSTRAP_LOG"
  grep -Fxq 'download=https://bun.sh/install' "$BOOTSTRAP_LOG"
  grep -Fq "installed-bun=$HOME/.dotfiles/bin/dotfiles setup --non-interactive --dry-run" "$BOOTSTRAP_LOG"
}

@test "forwards normalized setup arguments without invoking a shell" {
  run_installer \
    --non-interactive \
    --select core-tools \
    --select shell,git \
    --skip homebrew-packages \
    --dry-run

  [ "$status" -eq 0 ]
  arguments="$(grep '^arg=' "$BOOTSTRAP_LOG" | tail -n 10 | sed 's/^arg=//' | paste -sd ' ' -)"
  [ "$arguments" = "$HOME/.dotfiles/bin/dotfiles setup --non-interactive --select core-tools shell git --skip homebrew-packages --dry-run" ]
}
