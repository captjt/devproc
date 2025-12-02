---
title: Installation
description: How to install DevProc on your system
---

DevProc can be installed via Homebrew, from source, or by downloading a pre-built binary.

## Homebrew (Recommended)

The easiest way to install DevProc on macOS or Linux:

```bash
brew tap captjt/devproc https://github.com/captjt/devproc
brew install devproc
```

This also installs shell completions automatically.

### Updating

```bash
brew upgrade devproc
```

## From Source

If you have [Bun](https://bun.sh) installed, you can run DevProc directly from source:

```bash
# Clone the repository
git clone https://github.com/captjt/devproc.git
cd devproc

# Install dependencies
bun install

# Run DevProc
bun run start
```

Or create a symlink for global access:

```bash
# Make the entry point executable
chmod +x src/index.tsx

# Create a symlink (adjust path as needed)
ln -s "$(pwd)/src/index.tsx" /usr/local/bin/devproc
```

## Download Binary

Download the latest pre-built binary from [GitHub Releases](https://github.com/captjt/devproc/releases).

Available platforms:

- macOS (Apple Silicon): `devproc-darwin-arm64`
- macOS (Intel): `devproc-darwin-x64`
- Linux (x64): `devproc-linux-x64`
- Linux (ARM64): `devproc-linux-arm64`

```bash
# Example for macOS Apple Silicon
curl -L https://github.com/captjt/devproc/releases/latest/download/devproc-v0.5.0-darwin-arm64.tar.gz | tar xz
chmod +x devproc
sudo mv devproc /usr/local/bin/
```

## Shell Completions

If you installed via Homebrew, completions are set up automatically. For manual installation:

### Bash

Add to your `~/.bashrc`:

```bash
eval "$(devproc completions bash)"
```

Or save to a file:

```bash
devproc completions bash > /usr/local/etc/bash_completion.d/devproc
```

### Zsh

Add to your `~/.zshrc`:

```bash
eval "$(devproc completions zsh)"
```

Or save to a file (ensure `~/.zsh/completions` is in your `fpath`):

```bash
devproc completions zsh > ~/.zsh/completions/_devproc
```

### Fish

Add to your `~/.config/fish/config.fish`:

```fish
devproc completions fish | source
```

Or save to a file:

```fish
devproc completions fish > ~/.config/fish/completions/devproc.fish
```

## Requirements

- **Bun** >= 1.0 (only for running from source)
- **macOS** or **Linux** (Windows not currently supported)

## Verifying Installation

```bash
devproc --version
```

You should see output like:

```
DevProc v0.5.0
```

## Next Steps

- [Quick Start](/devproc/getting-started/quick-start/) - Create your first config and run DevProc
