class KueBall < Formula
  desc "Interactive kubectl wizard CLI for AKS clusters"
  homepage "https://github.com/paperschool/homebrew-kue-ball"
  url "https://github.com/paperschool/homebrew-kue-ball/archive/refs/tags/v2.0.10.tar.gz"
  sha256 "1cda2dfcd3aa9c9f0ea49ba4140f421f2b857ab508effc77781303f87d0a6eef"
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
