#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ID="reply-polisher"

usage() {
    cat <<'EOF'
Install the Reply Polisher SillyTavern server plugin.

Usage:
  bash install-server-plugin.sh /path/to/SillyTavern
  SILLYTAVERN_DIR=/path/to/SillyTavern bash install-server-plugin.sh

Windows Git Bash example:
  bash install-server-plugin.sh "D:\path\to\SillyTavern"

Termux example:
  bash install-server-plugin.sh "$HOME/SillyTavern"

This copies ./server/* to:
  SillyTavern/plugins/reply-polisher/

It does not edit config.yaml. After installing, set:
  enableServerPlugins: true

Then restart SillyTavern.
EOF
}

fail() {
    printf 'Error: %s\n' "$1" >&2
    exit 1
}

normalize_path() {
    local input="$1"

    if command -v cygpath >/dev/null 2>&1; then
        cygpath -u "$input" 2>/dev/null || printf '%s\n' "$input"
        return
    fi

    printf '%s\n' "$input"
}

has_enabled_server_plugins() {
    local config_file="$1"

    awk '
        NR == 1 { sub(/^\357\273\277/, "") }
        /^[[:space:]]*enableServerPlugins:[[:space:]]*true[[:space:]]*$/ { found = 1 }
        END { exit found ? 0 : 1 }
    ' "$config_file"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

if [[ $# -gt 1 ]]; then
    usage >&2
    exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SOURCE_DIR="${SCRIPT_DIR}/server"

TARGET_INPUT="${1:-${SILLYTAVERN_DIR:-}}"
if [[ -z "$TARGET_INPUT" ]]; then
    usage >&2
    fail "SillyTavern path is required."
fi

TARGET_DIR="$(normalize_path "$TARGET_INPUT")"
DEST_DIR="${TARGET_DIR}/plugins/${PLUGIN_ID}"

[[ -d "$SOURCE_DIR" ]] || fail "Server plugin source folder not found: $SOURCE_DIR"
[[ -f "${SOURCE_DIR}/index.js" ]] || fail "Server plugin source is missing index.js."
[[ -f "${SOURCE_DIR}/package.json" ]] || fail "Server plugin source is missing package.json."
[[ -d "$TARGET_DIR" ]] || fail "SillyTavern folder not found: $TARGET_DIR"
[[ -f "${TARGET_DIR}/package.json" && -d "${TARGET_DIR}/public" ]] || {
    printf 'Warning: %s does not look like a SillyTavern root folder.\n' "$TARGET_DIR" >&2
}

mkdir -p "$DEST_DIR"
cp -R "${SOURCE_DIR}/." "$DEST_DIR/"

printf 'Installed Reply Polisher server plugin to:\n  %s\n' "$DEST_DIR"

if [[ -f "${TARGET_DIR}/config.yaml" ]]; then
    if has_enabled_server_plugins "${TARGET_DIR}/config.yaml"; then
        printf 'Config check: enableServerPlugins is true.\n'
    else
        printf 'Config check: set enableServerPlugins: true in %s\n' "${TARGET_DIR}/config.yaml"
    fi
else
    printf 'Config check: config.yaml was not found under %s\n' "$TARGET_DIR"
fi

printf 'Restart SillyTavern before testing Reply Polisher again.\n'
