/**
 * Shell completion scripts for devproc
 */

const COMMANDS = ["up", "down", "restart", "status", "init", "validate", "completions"]
const OPTIONS = ["-c", "--config", "-w", "--watch", "-h", "--help", "-v", "--version"]
const SHELLS = ["bash", "zsh", "fish"]

/**
 * Generate bash completion script
 */
export function bashCompletion(): string {
  return `# devproc bash completion
# Add to ~/.bashrc or ~/.bash_profile:
#   eval "$(devproc completions bash)"
# Or save to a file:
#   devproc completions bash > /usr/local/etc/bash_completion.d/devproc

_devproc() {
    local cur prev words cword
    _init_completion || return

    local commands="${COMMANDS.join(" ")}"
    local options="${OPTIONS.join(" ")}"
    local shells="${SHELLS.join(" ")}"

    case "\${prev}" in
        -c|--config)
            # Complete yaml files
            _filedir '@(yaml|yml)'
            return
            ;;
        completions)
            COMPREPLY=( $(compgen -W "\${shells}" -- "\${cur}") )
            return
            ;;
    esac

    if [[ "\${cur}" == -* ]]; then
        COMPREPLY=( $(compgen -W "\${options}" -- "\${cur}") )
    elif [[ \${cword} -eq 1 ]]; then
        COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
    fi
}

complete -F _devproc devproc
`
}

/**
 * Generate zsh completion script
 */
export function zshCompletion(): string {
  return `#compdef devproc
# devproc zsh completion
# Add to ~/.zshrc:
#   eval "$(devproc completions zsh)"
# Or save to a file in your fpath:
#   devproc completions zsh > ~/.zsh/completions/_devproc

_devproc() {
    local -a commands options shells

    commands=(
        'up:Start all services (default)'
        'down:Stop all services'
        'restart:Restart all services'
        'status:Show service status'
        'init:Create a new devproc.yaml config file'
        'validate:Validate the config file'
        'completions:Generate shell completions'
    )

    options=(
        '-c[Path to config file]:config file:_files -g "*.y(a|)ml"'
        '--config[Path to config file]:config file:_files -g "*.y(a|)ml"'
        '-w[Watch config file for changes]'
        '--watch[Watch config file for changes]'
        '-h[Show help]'
        '--help[Show help]'
        '-v[Show version]'
        '--version[Show version]'
    )

    shells=(
        'bash:Generate bash completions'
        'zsh:Generate zsh completions'
        'fish:Generate fish completions'
    )

    _arguments -s \\
        '1: :->command' \\
        '*: :->args' \\
        && return 0

    case "\$state" in
        command)
            _describe -t commands 'devproc command' commands
            _describe -t options 'options' options
            ;;
        args)
            case "\$words[2]" in
                completions)
                    _describe -t shells 'shell' shells
                    ;;
                *)
                    _describe -t options 'options' options
                    ;;
            esac
            ;;
    esac
}

_devproc "\$@"
`
}

/**
 * Generate fish completion script
 */
export function fishCompletion(): string {
  return `# devproc fish completion
# Add to ~/.config/fish/config.fish:
#   devproc completions fish | source
# Or save to a file:
#   devproc completions fish > ~/.config/fish/completions/devproc.fish

# Disable file completion by default
complete -c devproc -f

# Commands
complete -c devproc -n "__fish_use_subcommand" -a "up" -d "Start all services (default)"
complete -c devproc -n "__fish_use_subcommand" -a "down" -d "Stop all services"
complete -c devproc -n "__fish_use_subcommand" -a "restart" -d "Restart all services"
complete -c devproc -n "__fish_use_subcommand" -a "status" -d "Show service status"
complete -c devproc -n "__fish_use_subcommand" -a "init" -d "Create a new devproc.yaml config file"
complete -c devproc -n "__fish_use_subcommand" -a "validate" -d "Validate the config file"
complete -c devproc -n "__fish_use_subcommand" -a "completions" -d "Generate shell completions"

# Options
complete -c devproc -s c -l config -d "Path to config file" -r -F
complete -c devproc -s w -l watch -d "Watch config file for changes"
complete -c devproc -s h -l help -d "Show help"
complete -c devproc -s v -l version -d "Show version"

# Completions subcommand
complete -c devproc -n "__fish_seen_subcommand_from completions" -a "bash" -d "Generate bash completions"
complete -c devproc -n "__fish_seen_subcommand_from completions" -a "zsh" -d "Generate zsh completions"
complete -c devproc -n "__fish_seen_subcommand_from completions" -a "fish" -d "Generate fish completions"
`
}

/**
 * Get completion script for a specific shell
 */
export function getCompletion(shell: string): string | null {
  switch (shell.toLowerCase()) {
    case "bash":
      return bashCompletion()
    case "zsh":
      return zshCompletion()
    case "fish":
      return fishCompletion()
    default:
      return null
  }
}

/**
 * List of supported shells
 */
export const SUPPORTED_SHELLS = SHELLS
