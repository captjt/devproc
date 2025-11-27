# typed: false
# frozen_string_literal: true

class Devproc < Formula
  desc "Terminal UI for managing local development environments"
  homepage "https://github.com/captjt/devproc"
  version "0.5.1"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/captjt/devproc/releases/download/v0.5.1/devproc-v0.5.1-darwin-arm64.tar.gz"
      sha256 "176c2972e09b29d1c7696472ca786c1a25ef0a30d2e5aed59581d154d4a359bd"
    else
      url "https://github.com/captjt/devproc/releases/download/v0.5.1/devproc-v0.5.1-darwin-x64.tar.gz"
      sha256 "c6f46551a7707d580e8cb7832720124534d1536fb5fb985ad2285e3d1e1e45bc"
    end
  end

  on_linux do
    url "https://github.com/captjt/devproc/releases/download/v0.5.1/devproc-v0.5.1-linux-x64.tar.gz"
    sha256 "80f72c8b227438925f4085c475d5e78747774ad959a87d50a84fd2a4532f65bf"
  end

  def install
    bin.install "devproc"
  end

  test do
    assert_match "DevProc v#{version}", shell_output("#{bin}/devproc --version")
  end
end
