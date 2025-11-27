# typed: false
# frozen_string_literal: true

class Devproc < Formula
  desc "Terminal UI for managing local development environments"
  homepage "https://github.com/captjt/devproc"
  version "0.5.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/captjt/devproc/releases/download/v0.5.0/devproc-v0.5.0-darwin-arm64.tar.gz"
      sha256 "ace7cae8bbf140ea06d961eede6e0d73892167627e30639d8cbb33f092dfee88"
    else
      url "https://github.com/captjt/devproc/releases/download/v0.5.0/devproc-v0.5.0-darwin-x64.tar.gz"
      sha256 "510801862917819d5cf35bade9a1579194f6cb7767dfb561df92c5b5a78743d2"
    end
  end

  on_linux do
    url "https://github.com/captjt/devproc/releases/download/v0.5.0/devproc-v0.5.0-linux-x64.tar.gz"
    sha256 "4239c8ebbffa61378bd16ef99d7a522c883fbdc6a59728e4732b69f1644b0605"
  end

  def install
    bin.install "devproc"

    # Generate and install shell completions
    generate_completions_from_executable(bin/"devproc", "completions")
  end

  test do
    assert_match "DevProc v#{version}", shell_output("#{bin}/devproc --version")
  end
end
