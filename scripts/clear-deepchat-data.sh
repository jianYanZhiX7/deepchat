#!/usr/bin/env bash
set -euo pipefail

APP_NAME='DeepChat'
BUNDLE_ID='com.wefonk.deepchat'
BACKUP_ROOT="$HOME/.deepchat-backups"

usage() {
  cat <<'EOF'
用法: clear-deepchat-data.sh [选项]

清除 DeepChat 的全部本地数据（设置、会话、插件、模型缓存、登录态等），
清理完成后 DeepChat 将恢复为首次打开的状态。

选项:
  -y, --yes     跳过确认提示
  -n, --dry-run 仅列出将被清理的内容，不执行任何修改
  --purge       直接删除数据；默认会先备份到 ~/.deepchat-backups
  -h, --help    显示帮助

清理前会先退出正在运行的 DeepChat（macOS 自动退出，其它系统请手动退出）。
EOF
}

app_running() {
  pgrep -x "$APP_NAME" >/dev/null 2>&1
}

collect_targets() {
  case "$(uname -s)" in
    Darwin)
      for path in \
        "$HOME/Library/Application Support/$APP_NAME" \
        "$HOME/Library/Preferences/$BUNDLE_ID.plist" \
        "$HOME/Library/Saved Application State/$BUNDLE_ID.savedState" \
        "$HOME/Library/Caches/$APP_NAME" \
        "$HOME/Library/WebKit/$APP_NAME" \
        "$HOME/Library/HTTPStorages/$APP_NAME" \
        "$HOME/Library/Logs/$APP_NAME"; do
        if [ -e "$path" ]; then
          targets+=("$path")
        fi
      done
      ;;
    Linux)
      for path in \
        "${XDG_CONFIG_HOME:-$HOME/.config}/$APP_NAME" \
        "${XDG_CACHE_HOME:-$HOME/.cache}/$APP_NAME"; do
        if [ -e "$path" ]; then
          targets+=("$path")
        fi
      done
      ;;
    MINGW* | MSYS* | CYGWIN*)
      for path in "$APPDATA/$APP_NAME" "$LOCALAPPDATA/$APP_NAME"; do
        if [ -e "$path" ]; then
          targets+=("$path")
        fi
      done
      ;;
    *)
      echo "不支持的操作系统: $(uname -s)" >&2
      exit 1
      ;;
  esac
}

ensure_app_quit() {
  if ! app_running; then
    return 0
  fi
  if [ "$(uname -s)" != 'Darwin' ]; then
    echo '检测到 DeepChat 正在运行，请先手动退出后再执行本脚本。' >&2
    exit 1
  fi
  echo '检测到 DeepChat 正在运行，正在尝试退出...'
  osascript -e "tell application \"$APP_NAME\" to quit" >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if ! app_running; then
      echo 'DeepChat 已退出。'
      return 0
    fi
    sleep 1
  done
  echo '无法自动退出 DeepChat，请手动退出后重试。' >&2
  exit 1
}

list_targets() {
  for path in "${targets[@]}"; do
    printf '  %s  (%s)\n' "$path" "$(du -sh "$path" 2>/dev/null | cut -f1)"
  done
}

main() {
  local purge=0
  local yes=0
  local dry_run=0
  while [ "$#" -gt 0 ]; do
    case "$1" in
      -y | --yes) yes=1 ;;
      --purge) purge=1 ;;
      -n | --dry-run) dry_run=1 ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        echo "未知参数: $1" >&2
        usage >&2
        exit 2
        ;;
    esac
    shift
  done

  collect_targets

  if [ "${#targets[@]}" -eq 0 ]; then
    echo '未找到 DeepChat 的本地数据，无需清理。'
    exit 0
  fi

  if [ "$dry_run" -eq 1 ]; then
    echo '将清理以下内容（当前未做任何修改）:'
    list_targets
    if app_running; then
      echo
      echo '注意: DeepChat 正在运行，正式清理前请先退出它。'
    fi
    exit 0
  fi

  ensure_app_quit

  if [ "$purge" -eq 1 ]; then
    echo '此操作将直接删除以下内容:'
  else
    echo '将清理以下内容（默认先备份）:'
  fi
  list_targets

  if [ "$yes" -eq 0 ]; then
    local answer=''
    printf '确认继续？（输入 yes 取消其他输入均为放弃）: '
    read -r answer
    if [ "$answer" != 'yes' ]; then
      echo '已取消。'
      exit 0
    fi
  fi

  local backup_dir=''
  if [ "$purge" -eq 0 ]; then
    backup_dir="$BACKUP_ROOT/$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"
    for index in "${!targets[@]}"; do
      printf '%s\t%s\n' "$backup_dir/$index" "${targets[$index]}" >>"$backup_dir/MANIFEST.tsv"
      mv "${targets[$index]}" "$backup_dir/$index"
    done
  else
    rm -rf "${targets[@]}"
  fi

  echo
  echo '清理完成。DeepChat 下次启动将恢复为首次打开的状态。'
  if [ "$purge" -eq 0 ]; then
    echo "原数据已备份到: $backup_dir"
    echo '如需恢复，将备份目录中的条目按 MANIFEST.tsv 记录的路径移回原位。'
  fi
}

targets=()
main "$@"