setup_bootstrap_test() {
  TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/dotfiles-bootstrap.XXXXXX")"
  TEST_HOME="$TEST_ROOT/home"
  FAKE_BIN="$TEST_ROOT/bin"
  BOOTSTRAP_LOG="$TEST_ROOT/bootstrap.log"
  SYSTEM_GIT="$(command -v git)"
  INSTALLER="$BATS_TEST_DIRNAME/../../install.sh"
  mkdir -p "$TEST_HOME" "$FAKE_BIN"
  : >"$BOOTSTRAP_LOG"

  export TEST_ROOT TEST_HOME FAKE_BIN BOOTSTRAP_LOG SYSTEM_GIT INSTALLER
  export HOME="$TEST_HOME"
  export PATH="$FAKE_BIN:/usr/bin:/bin"
  export DOTFILES_TEST_EUID=501
  export FAKE_UNAME_S=Darwin
  export FAKE_UNAME_M=arm64
  export DOTFILES_OS_RELEASE_FILE="$BATS_TEST_DIRNAME/../fixtures/os-release/ubuntu"

  create_fake_uname
  create_fake_tool bun
  create_fake_tool chezmoi
  create_fake_git
}

create_fake_uname() {
  cat >"$FAKE_BIN/uname" <<'EOF'
#!/bin/bash
case "$1" in
  -s) printf '%s\n' "$FAKE_UNAME_S" ;;
  -m) printf '%s\n' "$FAKE_UNAME_M" ;;
  *) exit 2 ;;
esac
EOF
  chmod +x "$FAKE_BIN/uname"
}

teardown_bootstrap_test() {
  rm -rf "$TEST_ROOT"
}

create_fake_tool() {
  tool="$1"
  tool_path="$FAKE_BIN/$tool"
  cat >"$tool_path" <<EOF
#!/bin/bash
printf '%s\n' 'tool=$tool' >>"\$BOOTSTRAP_LOG"
for argument in "\$@"; do printf 'arg=%s\n' "\$argument" >>"\$BOOTSTRAP_LOG"; done
exit 0
EOF
  chmod +x "$tool_path"
}

create_fake_git() {
  git_path="$FAKE_BIN/git"
  cat >"$git_path" <<EOF
#!/bin/bash
if [ "\${1-}" = clone ]; then
  printf 'git-clone=%s|%s\n' "\$2" "\$3" >>"\$BOOTSTRAP_LOG"
  mkdir -p "\$3/bin" "\$3/.git"
  : >"\$3/bin/dotfiles"
  exit 0
fi
exec "$SYSTEM_GIT" "\$@"
EOF
  chmod +x "$git_path"
}

create_fake_installer_curl() {
  cat >"$FAKE_BIN/curl" <<'CURL'
#!/bin/bash
destination=
url=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --output) destination="$2"; shift ;;
    https://*) url="$1" ;;
  esac
  shift
done
printf 'download=%s\n' "$url" >>"$BOOTSTRAP_LOG"
case "$url" in
  https://get.chezmoi.io)
    cat >"$destination" <<'CHEZMOI'
#!/bin/sh
while [ "$#" -gt 0 ]; do
  if [ "$1" = -b ]; then shift; bindir="$1"; fi
  shift
done
mkdir -p "$bindir"
cat >"$bindir/chezmoi" <<'TOOL'
#!/bin/bash
printf 'installed-chezmoi=%s\n' "$*" >>"$BOOTSTRAP_LOG"
exit 0
TOOL
chmod +x "$bindir/chezmoi"
CHEZMOI
    ;;
  https://bun.sh/install)
    cat >"$destination" <<'BUN'
#!/bin/bash
mkdir -p "$BUN_INSTALL/bin"
cat >"$BUN_INSTALL/bin/bun" <<'TOOL'
#!/bin/bash
printf 'installed-bun=%s\n' "$*" >>"$BOOTSTRAP_LOG"
exit 0
TOOL
chmod +x "$BUN_INSTALL/bin/bun"
BUN
    ;;
  *) exit 22 ;;
esac
CURL
  chmod +x "$FAKE_BIN/curl"
}

create_expected_checkout() {
  checkout="$HOME/.dotfiles"
  mkdir -p "$checkout/bin"
  "$SYSTEM_GIT" -C "$checkout" init -q
  "$SYSTEM_GIT" -C "$checkout" remote add origin https://github.com/semencov/dotfiles.git
  : >"$checkout/bin/dotfiles"
}

run_installer() {
  run /bin/bash "$INSTALLER" "$@"
}
