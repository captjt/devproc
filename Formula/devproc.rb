# typed: false
# frozen_string_literal: true

class Devproc < Formula
  desc "Terminal UI for managing local development environments"
  homepage "https://github.com/captjt/devproc"
  version "0.5.2"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/captjt/devproc/releases/download/v0.5.2/devproc-v0.5.2-darwin-arm64.tar.gz"
      sha256 "45464509515b1bf65c1ff7e4120122a6817029fda7096e51945dde4191315530"
    else
      url "https://github.com/captjt/devproc/releases/download/v0.5.2/devproc-v0.5.2-darwin-x64.tar.gz"
      sha256 "bf39fc55524504e17bca1ffd8b25a1373cdb19f86e12460cd7dcf8b64bf6fc75"
    end
  end

  on_linux do
    url "https://github.com/captjt/devproc/releases/download/v0.5.2/devproc-v0.5.2-linux-x64.tar.gz"
    sha256 "c7f36afcadeb210b991922b9c1399fe67b3cd1f3417a4eb5d12af3fa8f1f6a51"
  end

  def install
    bin.install "devproc"
  end

  test do
    assert_match "DevProc v#{version}", shell_output("#{bin}/devproc --version")
  end
end
