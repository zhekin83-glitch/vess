#!/usr/bin/env bash
# Build Linux .deb inside Ubuntu 24.04 (run via Docker on Windows hosts).
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
export NO_STRIP=true
export CARGO_TERM_COLOR=always
export APPIMAGE_EXTRACT_AND_RUN=1

echo "==> apt packages"
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates curl wget xz-utils build-essential pkg-config \
  libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libfuse2 \
  libssl-dev libgtk-3-dev libayatana-appindicator3-dev \
  python3 python3-pip python3-venv git

echo "==> Node 20"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "==> Rust"
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

echo "==> uv"
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

cd /src

echo "==> Python build tooling"
python3 -m pip install --break-system-packages build 2>/dev/null || python3 -m pip install build

echo "==> Frontend deps"
cd /src/apps/setup-center
rm -rf node_modules
npm ci
npm run build:web
npm run build

echo "==> Docs site (bundled resources)"
cd /src/docs-site
if [[ -f package-lock.json ]]; then
  npm ci
  npm run build
fi

echo "==> Placeholders"
mkdir -p /src/identity/personas
if [[ ! -f /src/identity/personas/user_custom.md ]]; then
  echo "# User Custom Persona (placeholder)" > /src/identity/personas/user_custom.md
fi

echo "==> Rust release binary"
cd /src/apps/setup-center/src-tauri
cargo build --release --features tauri/custom-protocol

echo "==> Prepare Tauri binary name"
cd /src
python3 scripts/prepare_tauri_binary.py

echo "==> Bootstrap resources (linux-x64)"
python3 build/prepare_bootstrap_resources.py \
  --commit-resources \
  --clean-output \
  --require-real-assets \
  --target-platform linux-x64

python3 build/prepare_bootstrap_resources.py --commit-resources --verify-only

echo "==> Assert seed Python exec bits"
SEED_DIR="apps/setup-center/src-tauri/resources/bootstrap/python"
fail=0
for f in "$SEED_DIR"/bin/*; do
  [[ -e "$f" ]] || continue
  if [[ ! -x "$f" ]]; then
    echo "ERROR: missing exec bit: $f" >&2
    fail=1
  fi
done
[[ "$fail" -eq 0 ]]

echo "==> Tauri bundle (.deb only)"
cd /src/apps/setup-center
npx tauri bundle \
  --bundles "deb" \
  --config '{"bundle":{"createUpdaterArtifacts":false}}'

echo "==> Done. Artifacts:"
find /src/apps/setup-center/src-tauri/target/release/bundle -type f \( -name '*.deb' -o -name '*.AppImage' \) -print
ls -lah /src/apps/setup-center/src-tauri/target/release/bundle/deb/ || true