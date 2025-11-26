# typed: false
# frozen_string_literal: true

class Devproc < Formula
  desc "Terminal UI for managing local development environments"
  homepage "https://github.com/captjt/devproc"
  version "0.3.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/captjt/devproc/releases/download/v0.3.0/devproc-v0.3.0-darwin-arm64.tar.gz"
      sha256 "devproc-v0.3.0-darwin-arm64.tar.gz.sha256:5585639def3de52513bdc61e3ac8bc9b968504707ba5a4186772fbaba38191da"
    else
      url "https://github.com/captjt/devproc/releases/download/v0.3.0/devproc-v0.3.0-darwin-x64.tar.gz"
      sha256 "devproc-v0.3.0-darwin-x64.tar.gz.sha256:fc0edec0d4ac43a3f1d2975bbc465da7b1554cf8bb40f1b6842952aef759a8af"
    end
  end

  on_linux do
    url "https://github.com/captjt/devproc/releases/download/v0.3.0/devproc-v0.3.0-linux-x64.tar.gz"
    sha256 "devproc-v0.3.0-linux-x64.tar.gz.sha256:7d161ef05e8b4a254678c4199a287805e3f842c3f52a57e890ccaa95d78ff064"
  end

  def install
    bin.install "devproc"
  end

  test do
    assert_match "DevProc v#{version}", shell_output("#{bin}/devproc --version")
  end
end
