class KueBall < Formula
  desc "Interactive kubectl wizard CLI for AKS clusters"
  homepage "https://github.com/paperschool/homebrew-kue-ball"
  url "https://github.com/paperschool/homebrew-kue-ball/archive/refs/tags/v2.0.0.tar.gz"
  sha256 "283e49b61141071f767a779fce1d47149e53a289dca513c99d6ea0c60ee2c3df"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_predicate bin/"kue-ball", :exist?
  end
end
