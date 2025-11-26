# typed: false
# frozen_string_literal: true

class Devproc < Formula
  desc "Terminal UI for managing local development environments"
  homepage "https://github.com/captjt/devproc"
  version "0.3.2"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/captjt/devproc/releases/download/v0.3.2/devproc-v0.3.2-darwin-arm64.tar.gz"
      sha256 "f49168151bdd7f0c7d56352f906e1feeb457a5382de3f099273e88b4d16ee774"
    else
      url "https://github.com/captjt/devproc/releases/download/v0.3.2/devproc-v0.3.2-darwin-x64.tar.gz"
      sha256 "d3560e042a4468479f3924cd1a93f02128f723c3b984ec19707e3b84fa343942"
    end
  end

  on_linux do
    url "https://github.com/captjt/devproc/releases/download/v0.3.2/devproc-v0.3.2-linux-x64.tar.gz"
    sha256 "14dcdc0422114050fdf0198d9a13f215c44bf3c229557639ec550b52aa4f9961"
  end

  def install
    bin.install "devproc"
  end

  test do
    assert_match "DevProc v#{version}", shell_output("#{bin}/devproc --version")
  end
end
