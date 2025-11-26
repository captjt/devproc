# typed: false
# frozen_string_literal: true

class Devproc < Formula
  desc "Terminal UI for managing local development environments"
  homepage "https://github.com/captjt/devproc"
  version "0.3.1"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/captjt/devproc/releases/download/v0.3.1/devproc-v0.3.1-darwin-arm64.tar.gz"
      sha256 "33561d6f0c70edbfe116e2b4220ebafd5898b8272eb6a47314629d6ed983556d"
    else
      url "https://github.com/captjt/devproc/releases/download/v0.3.1/devproc-v0.3.1-darwin-x64.tar.gz"
      sha256 "746d36ff502b8d20ab85649dadcc68f16532e1639794bc8b9dbbc1bcc948452f"
    end
  end

  on_linux do
    url "https://github.com/captjt/devproc/releases/download/v0.3.1/devproc-v0.3.1-linux-x64.tar.gz"
    sha256 "c0968461d31dad0fd5a36ae311037ed118bdde8a8da73a98ab2b0a365675d31e"
  end

  def install
    bin.install "devproc"
  end

  test do
    assert_match "DevProc v#{version}", shell_output("#{bin}/devproc --version")
  end
end
