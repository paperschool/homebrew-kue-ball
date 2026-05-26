class KueBall < Formula
  desc "Interactive kubectl wizard CLI for AKS clusters"
  homepage "https://github.com/paperschool/homebrew-kue-ball"
  url "https://github.com/paperschool/homebrew-kue-ball/archive/refs/tags/v1.0.0.tar.gz"
  sha256 "b5db6f4b9fc1461d4b9004d7971ddafb632ea0776698eb893118c079531078a8"
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
