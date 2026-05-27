#!/usr/bin/env bash
# Runs kue-ball inside a Linux amd64 Docker container (Ubuntu 22.04 + Node 22 +
# kubectl + kubelogin + helm + az), approximating the WSL2 Ubuntu environment a
# Windows user would have. Useful for verifying the Linux code path of shell.js's
# buildEnv() and catching POSIX-isms before a real WSL smoke test.
#
# First run builds the image (~3 min). Subsequent runs are cached.
# kubeconfig and az config are mounted from the host if they exist.

set -euo pipefail

IMAGE_NAME="kue-ball-wsl-test"
DOCKERFILE="Dockerfile.wsl-test"
NODE_MODULES_VOLUME="kue-ball-node-modules"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$REPO_ROOT"

# Build the image on first run (or after a Dockerfile change — the user can
# `docker image rm kue-ball-wsl-test` to force a rebuild).
if ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
    echo "→ Building $IMAGE_NAME (first run only — ~3 min, cached after this)..."
    docker build --platform=linux/amd64 -t "$IMAGE_NAME" -f "$DOCKERFILE" .
    echo ""
fi

# Mount host kubeconfig / az config if they exist; otherwise the container starts
# without them and the user can `az login --use-device-code` from inside.
declare -a mounts=()
[ -d "$HOME/.kube" ]  && mounts+=("-v" "$HOME/.kube:/root/.kube")
[ -d "$HOME/.azure" ] && mounts+=("-v" "$HOME/.azure:/root/.azure")

echo "→ Starting kue-ball in $IMAGE_NAME (Ubuntu 22.04 amd64)"
echo "  This approximates the WSL2 environment. Ctrl+C / 'Exit' returns you to the host."
echo ""

# node_modules lives in a named volume so it doesn't clobber the host's macOS
# build artifacts (or vice versa — the host's node_modules would not work in
# the Linux container if any native deps exist).
exec docker run -it --rm \
    --platform=linux/amd64 \
    --name kue-ball-wsl-test \
    -v "$REPO_ROOT:/app" \
    -v "$NODE_MODULES_VOLUME:/app/node_modules" \
    "${mounts[@]}" \
    -w /app \
    "$IMAGE_NAME" \
    bash -c "npm install --silent && node src/main.js"
