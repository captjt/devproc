# typed: false
# frozen_string_literal: true

class Devproc < Formula
  desc "Terminal UI for managing local development environments"
  homepage "https://github.com/captjt/devproc"
  version "0.4.1"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/captjt/devproc/releases/download/v0.4.1/devproc-v0.4.1-darwin-arm64.tar.gz"
      sha256 "4725aebb2d1fb80fb432a31c1bfb06b0501264cf01398f1ec6dd7f3dbd7097e0"
    else
      url "https://github.com/captjt/devproc/releases/download/v0.4.1/devproc-v0.4.1-darwin-x64.tar.gz"
      sha256 "17fc81cd580994d8b43c75c45c38cb32a793cc8689de07781cb0c0c74bb487ad"
    end
  end

  on_linux do
    url "https://github.com/captjt/devproc/releases/download/v0.4.1/devproc-v0.4.1-linux-x64.tar.gz"
    sha256 "95b9386e91f5022f6ef9f7c085dabf1f8a339ffc8adc66b1433ca939430f5aca"
  end

  def install
    bin.install "devproc"
  end

  test do
    assert_match "DevProc v#{version}", shell_output("#{bin}/devproc --version")
  end
end
