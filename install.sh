#!/bin/bash
set -euo pipefail

DOTFILES_REMOTE="https://github.com/semencov/dotfiles.git"
DOTFILES_DIR="${HOME}/.dotfiles"
STATE_DIR="${HOME}/.local/state/dotfiles"
BACKUP_ROOT="${STATE_DIR}/backups"
USER_BIN="${HOME}/.local/bin"
CHEZMOI_INSTALL_URL="https://get.chezmoi.io"
BUN_INSTALL_URL="https://bun.sh/install"

NON_INTERACTIVE=0
DRY_RUN=0
SELECTED_TASKS=()
SKIPPED_TASKS=()
SELECTED_COUNT=0
SKIPPED_COUNT=0
TEMPORARY_FILES=("")

log() {
  printf '==> %s\n' "$*"
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  local path
  for path in "${TEMPORARY_FILES[@]}"; do
    if [ -n "$path" ] && [ "${path#"$STATE_DIR"/}" != "$path" ]; then
      rm -f "$path"
    fi
  done
}

trap cleanup EXIT

append_task_values() {
  local destination="$1"
  local remaining="$2"
  local value

  while :; do
    case "$remaining" in
      *,*)
        value="${remaining%%,*}"
        remaining="${remaining#*,}"
        ;;
      *)
        value="$remaining"
        remaining=""
        ;;
    esac
    [ -n "$value" ] || fail "Task identifiers must not be empty"
    if [ "$destination" = select ]; then
      SELECTED_TASKS[SELECTED_COUNT]="$value"
      SELECTED_COUNT=$((SELECTED_COUNT + 1))
    else
      SKIPPED_TASKS[SKIPPED_COUNT]="$value"
      SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    fi
    [ -z "$remaining" ] && break
  done
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --non-interactive)
      NON_INTERACTIVE=1
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    --select | --skip)
      [ "$#" -ge 2 ] || fail "$1 requires a task identifier"
      case "$2" in
        --*) fail "$1 requires a task identifier" ;;
      esac
      if [ "$1" = --select ]; then
        append_task_values select "$2"
      else
        append_task_values skip "$2"
      fi
      shift
      ;;
    --help | -h)
      printf '%s\n' \
        'Usage: install.sh [--non-interactive] [--select <id[,id...]>] [--skip <id[,id...]>] [--dry-run]'
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
  shift
done

[ "$EUID" -ne 0 ] || fail "Do not run this installer as root"
EFFECTIVE_UID="${DOTFILES_TEST_EUID:-$EUID}"
[ "$EFFECTIVE_UID" -ne 0 ] || fail "Do not run this installer as root"
[ -n "${HOME:-}" ] && [ "$HOME" != / ] || fail "HOME must be a non-root absolute path"
case "$HOME" in
  /*) ;;
  *) fail "HOME must be an absolute path" ;;
esac

if [ "$NON_INTERACTIVE" -eq 0 ] && { [ ! -t 0 ] || [ ! -t 1 ]; }; then
  fail "An interactive terminal is required; pass --non-interactive for CI or headless setup"
fi

KERNEL="$(uname -s)"
MACHINE="$(uname -m)"
case "$MACHINE" in
  arm64 | aarch64) ARCH=arm64 ;;
  x86_64) ARCH=x64 ;;
  *) fail "Unsupported architecture: $MACHINE" ;;
esac

case "$KERNEL" in
  Darwin)
    PLATFORM=macos
    ;;
  Linux)
    OS_RELEASE_FILE="${DOTFILES_OS_RELEASE_FILE:-/etc/os-release}"
    [ -r "$OS_RELEASE_FILE" ] || fail "Cannot read $OS_RELEASE_FILE"
    PLATFORM_ID="$(sed -n 's/^ID=//p' "$OS_RELEASE_FILE" | head -n 1)"
    PLATFORM_ID="${PLATFORM_ID#\"}"
    PLATFORM_ID="${PLATFORM_ID%\"}"
    PLATFORM_ID="${PLATFORM_ID#\'}"
    PLATFORM_ID="${PLATFORM_ID%\'}"
    case "$PLATFORM_ID" in
      ubuntu | debian) PLATFORM="$PLATFORM_ID" ;;
      *) fail "Unsupported Linux distribution: ${PLATFORM_ID:-unknown}" ;;
    esac
    ;;
  *)
    fail "Unsupported operating system: $KERNEL"
    ;;
esac

log "Detected $PLATFORM/$ARCH"

install_linux_prerequisites() {
  local packages=()
  local package_count=0
  if ! command -v curl >/dev/null 2>&1; then
    packages[package_count]=curl
    package_count=$((package_count + 1))
    packages[package_count]=ca-certificates
    package_count=$((package_count + 1))
  fi
  if ! command -v git >/dev/null 2>&1; then
    packages[package_count]=git
    package_count=$((package_count + 1))
  fi
  if ! command -v unzip >/dev/null 2>&1; then
    packages[package_count]=unzip
    package_count=$((package_count + 1))
  fi
  [ "$package_count" -gt 0 ] || return 0

  command -v sudo >/dev/null 2>&1 || fail "sudo is required to install: ${packages[*]}"
  command -v apt-get >/dev/null 2>&1 || fail "apt-get is required to install: ${packages[*]}"
  log "Installing bootstrap prerequisites: ${packages[*]}"
  sudo apt-get update
  sudo apt-get install -y "${packages[@]}"
}

if [ "$PLATFORM" = ubuntu ] || [ "$PLATFORM" = debian ]; then
  install_linux_prerequisites
else
  command -v curl >/dev/null 2>&1 || fail "curl is required on macOS"
  command -v unzip >/dev/null 2>&1 || fail "unzip is required on macOS"
  if ! command -v git >/dev/null 2>&1; then
    command -v xcode-select >/dev/null 2>&1 || fail "xcode-select is required to install Git"
    log "Requesting installation of Apple Command Line Tools"
    xcode-select --install
    fail "Complete the Apple Command Line Tools installation, then rerun this command"
  fi
fi

command -v curl >/dev/null 2>&1 || fail "curl is unavailable after prerequisite installation"
command -v git >/dev/null 2>&1 || fail "Git is unavailable after prerequisite installation"
git --version >/dev/null 2>&1 || fail "Git does not respond successfully"

mkdir -p "$STATE_DIR" "$USER_BIN"
chmod 700 "$STATE_DIR" "$USER_BIN"

download_installer() {
  local url="$1"
  local destination="$2"
  log "Downloading $url"
  curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 --output "$destination" "$url"
}

install_chezmoi() {
  local installer="$STATE_DIR/chezmoi-install.$$.sh"
  TEMPORARY_FILES[${#TEMPORARY_FILES[@]}]="$installer"
  download_installer "$CHEZMOI_INSTALL_URL" "$installer"
  /bin/sh "$installer" -b "$USER_BIN"
}

install_bun() {
  local installer="$STATE_DIR/bun-install.$$.sh"
  TEMPORARY_FILES[${#TEMPORARY_FILES[@]}]="$installer"
  download_installer "$BUN_INSTALL_URL" "$installer"
  BUN_INSTALL="$HOME/.bun" /bin/bash "$installer"
}

if ! command -v chezmoi >/dev/null 2>&1; then
  log "Installing chezmoi"
  install_chezmoi
fi
if ! command -v bun >/dev/null 2>&1; then
  log "Installing Bun"
  install_bun
fi

PATH="$USER_BIN:$HOME/.bun/bin:$PATH"
export PATH
hash -r

CHEZMOI_BIN="$(command -v chezmoi || true)"
BUN_BIN="$(command -v bun || true)"
[ -n "$CHEZMOI_BIN" ] || fail "chezmoi is unavailable after installation"
[ -n "$BUN_BIN" ] || fail "Bun is unavailable after installation"
"$CHEZMOI_BIN" --version >/dev/null || fail "chezmoi does not respond successfully"
"$BUN_BIN" --version >/dev/null || fail "Bun does not respond successfully"

is_expected_checkout() {
  local prefix
  local remote
  [ -d "$DOTFILES_DIR" ] || return 1
  [ ! -L "$DOTFILES_DIR" ] || return 1
  git -C "$DOTFILES_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 1
  prefix="$(git -C "$DOTFILES_DIR" rev-parse --show-prefix 2>/dev/null || true)"
  [ -z "$prefix" ] || return 1
  remote="$(git -C "$DOTFILES_DIR" config --get remote.origin.url 2>/dev/null || true)"
  [ "$remote" = "$DOTFILES_REMOTE" ]
}

backup_unrelated_checkout() {
  local timestamp
  local archive
  timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"
  archive="$BACKUP_ROOT/bootstrap-${timestamp}-$$"
  mkdir -p "$archive"
  chmod 700 "$BACKUP_ROOT" "$archive"
  mv "$DOTFILES_DIR" "$archive/dotfiles"
  log "Preserved unrelated checkout at $archive/dotfiles"
}

if [ -e "$DOTFILES_DIR" ] || [ -L "$DOTFILES_DIR" ]; then
  if is_expected_checkout; then
    log "Preserving existing dotfiles checkout"
  else
    backup_unrelated_checkout
    git clone "$DOTFILES_REMOTE" "$DOTFILES_DIR"
  fi
else
  git clone "$DOTFILES_REMOTE" "$DOTFILES_DIR"
fi

log "Installing locked CLI dependencies"
"$BUN_BIN" install --cwd "$DOTFILES_DIR" --frozen-lockfile

SETUP_ARGUMENTS=(setup)
if [ "$NON_INTERACTIVE" -eq 1 ]; then
  SETUP_ARGUMENTS[${#SETUP_ARGUMENTS[@]}]=--non-interactive
fi
if [ "$SELECTED_COUNT" -gt 0 ]; then
  SETUP_ARGUMENTS[${#SETUP_ARGUMENTS[@]}]=--select
  for task in "${SELECTED_TASKS[@]}"; do
    SETUP_ARGUMENTS[${#SETUP_ARGUMENTS[@]}]="$task"
  done
fi
if [ "$SKIPPED_COUNT" -gt 0 ]; then
  SETUP_ARGUMENTS[${#SETUP_ARGUMENTS[@]}]=--skip
  for task in "${SKIPPED_TASKS[@]}"; do
    SETUP_ARGUMENTS[${#SETUP_ARGUMENTS[@]}]="$task"
  done
fi
if [ "$DRY_RUN" -eq 1 ]; then
  SETUP_ARGUMENTS[${#SETUP_ARGUMENTS[@]}]=--dry-run
fi

log "Launching dotfiles setup"
"$BUN_BIN" "$DOTFILES_DIR/bin/dotfiles" "${SETUP_ARGUMENTS[@]}"
