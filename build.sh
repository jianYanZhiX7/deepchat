#!/usr/bin/env bash
# Package DeepChat into a platform installer for the current OS/arch.
#
# Usage:
#   ./build.sh                  # build for host OS + host arch
#   ./build.sh --arch arm64     # override target arch
#   ./build.sh --clean          # wipe dist/ and out/ first
#   ./build.sh --dry-run        # print plan only
#   ./build.sh --no-runtime     # skip auto node runtime install
#   ./build.sh --no-cua-cache   # skip CUA driver pre-cache
#
# Delegates to the project's `build:<os>:<arch>` npm script, which already
# chains typecheck, electron-vite build, plugin bundling, duckdb-vss runtime
# install, and electron-builder.
#
# Auto-fixes two common local-build gaps:
#   1. runtime/node missing -> installed from public nodejs.org (no token)
#   2. CUA driver download flaky -> pre-cached with GitHub mirror fallback

set -Eeuo pipefail

ARCH=""
CLEAN=0
DRY_RUN=0
SKIP_RUNTIME=0
SKIP_CUA_CACHE=0

usage() {
  cat <<'EOF'
Usage: ./build.sh [options]

Options:
  -a, --arch <x64|arm64>   Target architecture (default: host arch)
  -c, --clean              Remove dist/ and out/ before building
  -n, --dry-run            Print the plan without executing
      --no-runtime         Skip auto node runtime install
      --no-cua-cache       Skip CUA driver pre-cache
  -h, --help               Show this help

Environment:
  GITHUB_MIRRORS          Space-separated GitHub mirror hosts used as a
                          fallback when direct release downloads fail.
                          Default: "ghfast.top gh-proxy.com"
  GITHUB_TOKEN            Only needed to install the full uv/rtk toolchain
                          (run `pnpm run installRuntime:<os>:<arch>`).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -a|--arch) ARCH="${2:?--arch requires a value}"; shift 2;;
    -c|--clean) CLEAN=1; shift;;
    -n|--dry-run) DRY_RUN=1; shift;;
    --no-runtime) SKIP_RUNTIME=1; shift;;
    --no-cua-cache) SKIP_CUA_CACHE=1; shift;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

# --- pretty log ---
c_blue=$'\033[1;34m'; c_yel=$'\033[1;33m'; c_red=$'\033[1;31m'; c_off=$'\033[0m'
log()  { printf '%s==>%s %s\n' "$c_blue" "$c_off" "$*"; }
warn() { printf '%s!!%s %s\n' "$c_yel" "$c_off" "$*" >&2; }
die()  { printf '%sxx%s %s\n' "$c_red" "$c_off" "$*" >&2; exit "${2:-1}"; }

trap 'die "Build failed at line $LINENO (exit $?)"' ERR

# --- detect host platform ---
detect_os() {
  case "$(uname -s)" in
    Linux*)  echo linux;;
    Darwin*) echo mac;;
    MINGW*|MSYS*|CYGWIN*|Windows_NT) echo win;;
    *) die "Unsupported OS: $(uname -s)" 3;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo x64;;
    aarch64|arm64) echo arm64;;
    *) die "Unsupported arch: $(uname -m)" 3;;
  esac
}

TARGET_OS="$(detect_os)"
TARGET_ARCH="${ARCH:-$(detect_arch)}"
[[ "$TARGET_ARCH" =~ ^(x64|arm64)$ ]] || die "Invalid --arch: $TARGET_ARCH (expected x64 or arm64)" 2

# --- validate toolchain versions against package.json engines ---
NODE_MIN="24.14.1"
PNPM_MIN="10.11.0"

ver_ge() {
  local IFS=.
  local -a a b
  read -ra a <<<"$1"
  read -ra b <<<"$2"
  local i ai bi
  for i in 0 1 2; do
    ai=${a[i]:-0}; bi=${b[i]:-0}
    if (( ai > bi )); then return 0; fi
    if (( ai < bi )); then return 1; fi
  done
  return 0
}

command -v node >/dev/null 2>&1 || die "node not found in PATH" 4
command -v pnpm >/dev/null 2>&1 || die "pnpm not found in PATH" 4
command -v curl >/dev/null 2>&1 || die "curl not found in PATH" 4
NODE_VER="$(node -v | sed 's/^v//')"
PNPM_VER="$(pnpm -v)"
ver_ge "$NODE_VER" "$NODE_MIN" || warn "Node $NODE_VER < required $NODE_MIN (package.json engines)"
ver_ge "$PNPM_VER" "$PNPM_MIN" || warn "pnpm $PNPM_VER < required $PNPM_MIN (package.json engines)"

# --- platform prerequisites ---
check_linux_libs() {
  if ldconfig -p 2>/dev/null | grep -q 'libfuse\.so\.2'; then return; fi
  if command -v dpkg >/dev/null 2>&1 && dpkg -l 2>/dev/null | grep -qE '^ii\s+libfuse2(t64)?\s'; then return; fi
  warn "libfuse2 not detected - AppImage packaging may fail."
  warn "  Fix: sudo apt-get install -y libfuse2t64"
}

# --- download helpers (direct first, then mirrors) ---
# GITHUB_MIRRORS: space-separated host list; each host prefixes the full URL.
# e.g. ghfast.top turns https://github.com/x into https://ghfast.top/https://github.com/x
curl_download() {
  local url="$1" out="$2" src
  local -a sources=("$url")
  local host
  for host in ${GITHUB_MIRRORS:-ghfast.top gh-proxy.com}; do
    sources+=("https://$host/$url")
  done
  for src in "${sources[@]}"; do
    log "  fetch: $src"
    if curl -sS -L --retry 3 --retry-delay 2 --max-time 300 -o "$out" "$src" && [[ -s "$out" ]]; then
      return 0
    fi
    rm -f "$out"
  done
  return 1
}

sha256_matches() {
  local file="$1" expected="$2" got
  [[ -f "$file" ]] || return 1
  got="$(sha256sum "$file" | cut -d' ' -f1)"
  [[ "$got" == "$expected" ]]
}

# --- ensure runtime/node is present (afterPack hard-requires it) ---
ensure_node_runtime() {
  local node_rel rt_platform
  case "$TARGET_OS" in
    win) node_rel="runtime/node/node.exe"; rt_platform=win32 ;;
    linux) node_rel="runtime/node/bin/node"; rt_platform=linux ;;
    mac)   node_rel="runtime/node/bin/node"; rt_platform=darwin ;;
  esac

  if [[ -x "$REPO_ROOT/$node_rel" ]]; then
    log "runtime/node: present"
    return 0
  fi

  log "runtime/node: missing - installing from public nodejs.org (no token needed)"
  node "$REPO_ROOT/scripts/install-runtime.mjs" \
    --platform "$rt_platform" --arch "$TARGET_ARCH" --types node \
    || die "Failed to install node runtime for $rt_platform/$TARGET_ARCH" 5
}

# --- ensure CUA driver is pre-cached (GitHub release, mirror-aware) ---
ensure_cua_cache() {
  # CUA driver upstream does not ship linux/arm64.
  if [[ "$TARGET_OS" == "linux" && "$TARGET_ARCH" == "arm64" ]]; then
    return 0
  fi

  local upstream_json="$REPO_ROOT/plugins/cua/vendor/cua-driver/upstream.json"
  [[ -f "$upstream_json" ]] || return 0

  local asset_key
  case "$TARGET_OS/$TARGET_ARCH" in
    linux/x64) asset_key=linux-x64 ;;
    mac/arm64) asset_key=darwin-arm64 ;;
    mac/x64)   asset_key=darwin-x64 ;;
    win/x64)   asset_key=windows-x64 ;;
    win/arm64) asset_key=windows-arm64 ;;
    *) return 0 ;;
  esac

  # Parse upstream.json with node (avoids fragile bash JSON parsing).
  local meta
  meta="$(node -e '
    const fs = require("fs");
    const path = require("path");
    const os = require("os");
    const [upstreamPath, assetKey] = [process.argv[1], process.argv[2]];
    const m = JSON.parse(fs.readFileSync(upstreamPath, "utf8"));
    const asset = m.assets && m.assets[assetKey];
    if (!asset) process.exit(1);
    const lines = [
      "CUA_TAG=" + JSON.stringify(m.tag),
      "CUA_RELEASE_BASE=" + JSON.stringify("https://github.com/trycua/cua/releases/download/" + m.tag),
      "CUA_CHECKSUMS_ASSET=" + JSON.stringify(m.checksumsAsset),
      "CUA_CHECKSUMS_SHA256=" + m.checksumsSha256,
      "CUA_ASSET_NAME=" + JSON.stringify(asset.name),
      "CUA_ASSET_SHA256=" + asset.sha256,
      "CUA_CACHE_DIR=" + JSON.stringify(path.join(os.tmpdir(), "deepchat-cua-driver-cache", m.tag))
    ];
    process.stdout.write(lines.join("\n") + "\n");
  ' "$upstream_json" "$asset_key" 2>/dev/null)" || {
    warn "CUA: cannot parse upstream.json - skipping precache"
    return 0
  }
  [[ -n "$meta" ]] || return 0
  eval "$meta"

  mkdir -p "$CUA_CACHE_DIR"
  local checksums_path="$CUA_CACHE_DIR/$CUA_CHECKSUMS_ASSET"
  local asset_path="$CUA_CACHE_DIR/$CUA_ASSET_NAME"

  if ! sha256_matches "$checksums_path" "$CUA_CHECKSUMS_SHA256"; then
    log "CUA: fetching $CUA_CHECKSUMS_ASSET"
    rm -f "$checksums_path"
    if ! curl_download "$CUA_RELEASE_BASE/$CUA_CHECKSUMS_ASSET" "$checksums_path"; then
      warn "CUA: checksums download failed - build will attempt its own fetch"
      return 0
    fi
    if ! sha256_matches "$checksums_path" "$CUA_CHECKSUMS_SHA256"; then
      warn "CUA: checksums sha256 mismatch - build will attempt its own fetch"
      rm -f "$checksums_path"
      return 0
    fi
  fi

  if ! sha256_matches "$asset_path" "$CUA_ASSET_SHA256"; then
    log "CUA: fetching $CUA_ASSET_NAME"
    rm -f "$asset_path"
    if ! curl_download "$CUA_RELEASE_BASE/$CUA_ASSET_NAME" "$asset_path"; then
      warn "CUA: asset download failed - build will attempt its own fetch"
      return 0
    fi
    if ! sha256_matches "$asset_path" "$CUA_ASSET_SHA256"; then
      warn "CUA: asset sha256 mismatch - build will attempt its own fetch"
      rm -f "$asset_path"
      return 0
    fi
  fi

  log "CUA: cache ready ($CUA_TAG)"
}

# --- pre-flight reporting ---
log "Target: $TARGET_OS $TARGET_ARCH"
log "Node:   $NODE_VER    pnpm: $PNPM_VER"
[[ "$TARGET_OS" == "linux" ]] && check_linux_libs

if [[ ! -d runtime ]]; then
  warn "runtime/ is missing - will auto-install node runtime (uv/rtk need GITHUB_TOKEN)"
fi

if [[ $DRY_RUN -eq 1 ]]; then
  log "Dry run - plan:"
  echo "    pnpm install --frozen-lockfile"
  if [[ "$TARGET_OS" == "linux" ]]; then
    echo "    install:sharp (configure sharp for linux-$TARGET_ARCH)"
    echo "    pnpm install --frozen-lockfile (reinstall)"
  fi
  [[ $SKIP_RUNTIME -eq 0 ]] && echo "    ensure node runtime (auto-install if missing)"
  [[ $SKIP_CUA_CACHE -eq 0 ]] && echo "    ensure CUA driver cache (mirror fallback)"
  echo "    pnpm run build:$TARGET_OS:$TARGET_ARCH"
  exit 0
fi

if [[ $CLEAN -eq 1 ]]; then
  log "Cleaning dist/ and out/"
  rm -rf dist out
fi

# --- execute ---
log "Run: pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile

if [[ "$TARGET_OS" == "linux" ]]; then
  log "Run: install:sharp (linux-$TARGET_ARCH)"
  TARGET_OS=linux TARGET_ARCH=$TARGET_ARCH pnpm run install:sharp
  log "Run: pnpm install --frozen-lockfile (reinstall)"
  pnpm install --frozen-lockfile
fi

[[ $SKIP_RUNTIME -eq 0 ]] && ensure_node_runtime
[[ $SKIP_CUA_CACHE -eq 0 ]] && ensure_cua_cache

log "Run: pnpm run build:$TARGET_OS:$TARGET_ARCH"
pnpm run "build:$TARGET_OS:$TARGET_ARCH"

# --- report artifacts ---
log "Build complete."
echo
log "Artifacts in dist/:"
ls -lh dist/ 2>/dev/null || warn "dist/ not found"

echo
shopt -s nullglob
installers=()
for ext in AppImage tar.gz dmg zip exe msi deb rpm; do
  for f in dist/*."$ext"; do installers+=("$f"); done
done
shopt -u nullglob

if [[ ${#installers[@]} -gt 0 ]]; then
  log "Installers:"
  for f in "${installers[@]}"; do ls -lh "$f"; done
fi
