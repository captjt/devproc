# typed: false
# frozen_string_literal: true

class Devproc < Formula
  desc "Terminal UI for managing local development environments"
  homepage "https://github.com/captjt/devproc"
  version "0.4.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/captjt/devproc/releases/download/v0.4.0/devproc-v0.4.0-darwin-arm64.tar.gz"
      sha256 "f2aed6084101d8b17ebbd3d4b587e7c54c4aecb558a3098806ed3dd774c6d77c"
    else
      url "https://github.com/captjt/devproc/releases/download/v0.4.0/devproc-v0.4.0-darwin-x64.tar.gz"
      sha256 "4a16cc12a54ccc2c98dd659ad295821ad3e2095a076145dff9f672af2bd008d7"
    end
  end

  on_linux do
    url "https://github.com/captjt/devproc/releases/download/v0.4.0/devproc-v0.4.0-linux-x64.tar.gz"
    sha256 "479fe01b1cb757fb85fc9ec72c05f2e39adaf412b3964fe5d959aa1ef5529bd7"
  end

  def install
    bin.install "devproc"
  end

  test do
    assert_match "DevProc v#{version}", shell_output("#{bin}/devproc --version")
  end
end
