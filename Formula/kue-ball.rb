class KueBall < Formula
  desc "Interactive kubectl wizard CLI for AKS clusters"
  homepage "https://github.com/paperschool/homebrew-kue-ball"
  url "https://github.com/paperschool/homebrew-kue-ball/archive/refs/tags/v2.0.9.tar.gz"
  sha256 "089d1b78b0fb62462bf452963565917f8a0b8330f1a9b19826886a3ab2eb784c"
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
