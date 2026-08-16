#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/build-release.sh [--arch <arch>] [--platform <platform>] [--skip-runtime]

Build a distributable release with the bundled Node runtime and the offline
claude-acp npm cache pre-populated.

Options:
  --arch <arch>       Target architecture: arm64 | x64 (default: current arch)
  --platform <plat>   Target platform: mac | win | linux (default: current platform)
  --skip-runtime      Skip downloading the bundled Node/uv/rtk runtime
  -h, --help          Show this help

Examples:
  scripts/build-release.sh
  scripts/build-release.sh --arch x64
  scripts/build-release.sh --platform mac --arch arm64

The script runs these steps in order:
  1. pnpm run installRuntime:<platform>:<arch>   (unless --skip-runtime)
  2. pnpm run acp:cache
  3. pnpm run build:<platform>:<arch>
EOF
}

fail() {
  echo "Error: $*" >&2
  exit 1
}

info() {
  printf '\n\033[1;34m==>\033[0m %s\n' "$*"
}

detect_platform() {
  case "$(uname -s)" in
    Darwin) echo 'mac' ;;
    Linux)  echo 'linux' ;;
    MINGW*|MSYS*|CYGWIN*) echo 'win' ;;
    *) fail "Unsupported host platform: $(uname -s)" ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    arm64|aarch64) echo 'arm64' ;;
    x86_64|amd64)  echo 'x64' ;;
    *) fail "Unsupported host architecture: $(uname -m)" ;;
  esac
}

PLATFORM="$(detect_platform)"
ARCH="$(detect_arch)"
SKIP_RUNTIME=0

while (($# > 0)); do
  case "$1" in
    --)
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --arch)
      [[ $# -ge 2 ]] || fail "--arch requires a value"
      ARCH="$2"
      shift 2
      ;;
    --platform)
      [[ $# -ge 2 ]] || fail "--platform requires a value"
      PLATFORM="$2"
      shift 2
      ;;
    --skip-runtime)
      SKIP_RUNTIME=1
      shift
      ;;
    *)
      fail "Unexpected argument: $1"
      ;;
  esac
done

case "$PLATFORM" in
  mac|win|linux) ;;
  *) fail "Unsupported target platform: ${PLATFORM} (expected mac | win | linux)" ;;
esac

case "$ARCH" in
  arm64|x64) ;;
  *) fail "Unsupported target architecture: ${ARCH} (expected arm64 | x64)" ;;
esac

HOST_PLATFORM="$(detect_platform)"
if [[ "$PLATFORM" != "$HOST_PLATFORM" ]]; then
  echo "Warning: cross-compiling ${PLATFORM} from ${HOST_PLATFORM} may require extra toolchain (wine, docker, etc.)." >&2
fi

command -v pnpm >/dev/null 2>&1 || fail "pnpm is not installed or not on PATH."

cd "$(dirname "$0")/.."

RUNTIME_STEP="installRuntime:${PLATFORM}:${ARCH}"
BUILD_STEP="build:${PLATFORM}:${ARCH}"

if ! node -e "const s=require('./package.json').scripts; process.exit(s['${RUNTIME_STEP}']?0:1)"; then
  fail "No npm script '${RUNTIME_STEP}' defined in package.json."
fi
if ! node -e "const s=require('./package.json').scripts; process.exit(s['${BUILD_STEP}']?0:1)"; then
  fail "No npm script '${BUILD_STEP}' defined in package.json."
fi

if [[ "$SKIP_RUNTIME" -eq 0 ]]; then
  info "Installing bundled runtime (${PLATFORM}/${ARCH})"
  pnpm run "$RUNTIME_STEP"
else
  info "Skipping runtime install (--skip-runtime)"
fi

info "Pre-populating offline claude-acp npm cache"
pnpm run acp:cache

info "Building release (${BUILD_STEP})"
pnpm run "$BUILD_STEP"

info "Done. Artifacts are in release/ (or dist/ for unpacked builds)."
