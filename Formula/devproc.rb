# typed: false
# frozen_string_literal: true

class Devproc < Formula
  desc "Terminal UI for managing local development environments"
  homepage "https://github.com/captjt/devproc"
  version "0.5.3"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/captjt/devproc/releases/download/v0.5.3/devproc-v0.5.3-darwin-arm64.tar.gz"
      sha256 "b26554eafd9729cbb711c203d715c318f17affedfea7592236d9bcb4efe1f293"
    else
      url "https://github.com/captjt/devproc/releases/download/v0.5.3/devproc-v0.5.3-darwin-x64.tar.gz"
      sha256 "65c0bbb23249dbc2d18ee5d5605983dc4ea50cbe9772fbe2c616c39a73028408"
    end
  end

  on_linux do
    url "https://github.com/captjt/devproc/releases/download/v0.5.3/devproc-v0.5.3-linux-x64.tar.gz"
    sha256 "dcf377183fdaa2a5773fde46ec5bbc06ad393ea1e9397c390d10cc1e6510267f"
  end

  def install
    bin.install "devproc"
  end

  test do
    assert_match "DevProc v#{version}", shell_output("#{bin}/devproc --version")
  end
end
