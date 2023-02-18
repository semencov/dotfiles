alias pjo="pj open"
alias pjc="pj clean"
alias pja="pj archive"

pj () {
    emulate -L zsh

    cmd="cd"
    project=$1

    case "$project" in
        "-h"|"--help")
            echo "Usage: pj [project]"
            return
            ;;
        "open")
            cmd=${=GUI_EDITOR}
            shift
            project=$1
            ;;
        "clean")
            cmd=pj-clean
            shift
            project=$1
            ;;
        "archive")
            cmd=pj-archive
            shift
            project=$1
            ;;
        *)
            project=$*
            ;;
    esac

    for basedir ($PROJECT_PATHS); do
        if [[ -d "$basedir/$project" ]]; then
            $cmd "$basedir/$project"
            return
        fi
    done

    echo "No such project '${project}'."
}

_pj () {
    emulate -L zsh

    typeset -a projects
    for basedir ($PROJECT_PATHS); do
        projects+=(${basedir}/*(/N))
    done

    compadd ${projects:t}
}

compdef _pj pj
