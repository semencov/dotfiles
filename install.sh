#!/bin/bash
set -u

DOTFILES_DIR="${HOME}/.dotfiles"
DOTFILES_ZIP="https://github.com/semencov/dotfiles/archive/master.zip"
DOTFILES_REMOTE="git@github.com:semencov/dotfiles.git"


# string formatters
if [[ -t 1 ]]; then
    tty_escape() { printf "\033[%sm" "$1"; }
else
    tty_escape() { :; }
fi
tty_mkbold() { tty_escape "1;$1"; }
tty_underline="$(tty_escape "4;39")"
tty_blue="$(tty_mkbold 34)"
tty_red="$(tty_mkbold 31)"
tty_bold="$(tty_mkbold 39)"
tty_reset="$(tty_escape 0)"

have_sudo_access() {
    local -a args
    if [[ -n "${SUDO_ASKPASS-}" ]]; then
        args=("-A")
    fi

    if [[ -z "${HAVE_SUDO_ACCESS-}" ]]; then
        if [[ -n "${args[*]-}" ]]; then
            /usr/bin/sudo "${args[@]}" -l mkdir &>/dev/null
        else
            /usr/bin/sudo -l mkdir &>/dev/null
        fi
        HAVE_SUDO_ACCESS="$?"
    fi

    if [[ "$HAVE_SUDO_ACCESS" -ne 0 ]]; then
        abort "Need sudo access on macOS (e.g. the user $USER to be an Administrator)!"
    fi

    return "$HAVE_SUDO_ACCESS"
}

shell_join() {
    local arg
    printf "%s" "$1"
    shift
    for arg in "$@"; do
        printf " "
        printf "%s" "${arg// /\ }"
    done
}

chomp() {
    printf "%s" "${1/"$'\n'"/}"
}

ohai() {
    printf "${tty_blue}==>${tty_bold} %s${tty_reset}\n" "$(shell_join "$@")"
}

warn() {
    printf "${tty_red}Warning${tty_reset}: %s\n" "$(chomp "$1")"
}

abort() {
    printf "%s\n" "$1"
    exit 1
}

execute() {
    if ! "$@"; then
        abort "$(printf "Failed during: %s" "$(shell_join "$@")")"
    fi
}

execute_sudo() {
    local -a args=("$@")
    if [[ -n "${SUDO_ASKPASS-}" ]]; then
        args=("-A" "${args[@]}")
    fi
    if have_sudo_access; then
        ohai "/usr/bin/sudo" "${args[@]}"
        execute "/usr/bin/sudo" "${args[@]}"
    else
        ohai "${args[@]}"
        execute "${args[@]}"
    fi
}

getc() {
    local save_state
    save_state=$(/bin/stty -g)
    /bin/stty raw -echo
    IFS= read -r -n 1 -d '' "$@"
    /bin/stty "$save_state"
}

major_minor() {
    echo "${1%%.*}.$(x="${1#*.}"; echo "${x%%.*}")"
}

macos_version="$(major_minor "$(/usr/bin/sw_vers -productVersion)")"

version_gt() {
    [[ "${1%.*}" -gt "${2%.*}" ]] || [[ "${1%.*}" -eq "${2%.*}" && "${1#*.}" -gt "${2#*.}" ]]
}

version_ge() {
    [[ "${1%.*}" -gt "${2%.*}" ]] || [[ "${1%.*}" -eq "${2%.*}" && "${1#*.}" -ge "${2#*.}" ]]
}

version_lt() {
    [[ "${1%.*}" -lt "${2%.*}" ]] || [[ "${1%.*}" -eq "${2%.*}" && "${1#*.}" -lt "${2#*.}" ]]
}

should_install_git() {
    if [[ $(command -v git) ]]; then
        return 1
    fi
}

should_install_command_line_tools() {
    if version_gt "$macos_version" "10.13"; then
        ! [[ -e "/Library/Developer/CommandLineTools/usr/bin/git" ]]
    else
        ! [[ -e "/Library/Developer/CommandLineTools/usr/bin/git" ]] ||
            ! [[ -e "/usr/include/iconv.h" ]]
    fi
}

install_command_line_tools() {
    if should_install_command_line_tools && version_ge "$macos_version" "10.13"; then
        ohai "Searching online for the Command Line Tools"
        # This temporary file prompts the 'softwareupdate' utility to list the Command Line Tools
        clt_placeholder="/tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress"
        execute_sudo "/usr/bin/touch" "$clt_placeholder"

        clt_label_command="/usr/sbin/softwareupdate -l |
                            grep -B 1 -E 'Command Line Tools' |
                            awk -F'*' '/^ *\\*/ {print \$2}' |
                            sed -e 's/^ *Label: //' -e 's/^ *//' |
                            sort -V |
                            tail -n1"
        clt_label="$(chomp "$(/bin/bash -c "$clt_label_command")")"

        if [[ -n "$clt_label" ]]; then
            ohai "Installing $clt_label"
            execute_sudo "/usr/sbin/softwareupdate" "-i" "$clt_label"
            execute_sudo "/bin/rm" "-f" "$clt_placeholder"
            execute_sudo "/usr/bin/xcode-select" "--switch" "/Library/Developer/CommandLineTools"
        fi
    fi

    # Headless install may have failed, so fallback to original 'xcode-select' method
    if should_install_command_line_tools && test -t 0; then
        ohai "Installing the Command Line Tools (expect a GUI popup):"
        execute_sudo "/usr/bin/xcode-select" "--install"
        echo "Press any key when the installation has completed."
        getc
        execute_sudo "/usr/bin/xcode-select" "--switch" "/Library/Developer/CommandLineTools"
    fi
}

install_homebrew() {
    execute "/bin/bash" "-c" "\"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)\""
}

clone_dotfiles() {
    execute "git" "clone" "${DOTFILES_REMOTE}" "${DOTFILES_DIR}"
    execute "cd" "${DOTFILES_DIR}"
}

sync_dotfiles() {
    execute "python" "${DOTFILES_DIR}/sync.py"
}

bundle_homebrew() {
    execute "brew" "bundle" "--global"
}

restore_mackup() {
    execute "mackup" "restore" "-f"
}

(
    install_command_line_tools
    install_homebrew
    clone_dotfiles
    sync_dotfiles
    bundle_homebrew
    restore_mackup
) || exit 1
