#!/usr/bin/env bash
set -Eeuo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ST="${1:-/home/www/SillyTavern}"
SRC="$HERE/server-plugin/vvv-theater-memory-server"
DST="$ST/plugins/vvv-theater-memory-server"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$(dirname "$ST")/VVV_STORY_MEMORY_SERVER_BACKUP_$STAMP"
fail(){ echo "❌ $*" >&2; exit 1; }
ok(){ echo "✅ $*"; }
[ -d "$ST" ] || fail "Không tìm thấy SillyTavern: $ST"
[ -f "$SRC/index.mjs" ] || fail "Kho mã thiếu tệp server-plugin/vvv-theater-memory-server/index.mjs"
command -v node >/dev/null || fail "Thiếu node"
node --check "$SRC/index.mjs" >/dev/null
mkdir -p "$BACKUP"
if [ -d "$DST" ]; then cp -a "$DST" "$BACKUP/vvv-theater-memory-server"; ok "Đã sao lưu plugin máy chủ cũ: $BACKUP"; fi
rm -rf "$DST"
mkdir -p "$(dirname "$DST")"
cp -a "$SRC" "$DST"
OWNER_GROUP="$(stat -c '%u:%g' "$ST")"
chown -R "$OWNER_GROUP" "$DST" || true
chmod -R u+rwX,go+rX "$DST"
ok "Đã cập nhật vvv-theater-memory-server"
echo "ℹ️ Thư mục ký ức vĩnh viễn không bị xóa; vẫn dùng dataRoot/vvv/vvv-theater-memory"
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe SillyTavern >/dev/null 2>&1; then pm2 restart SillyTavern --update-env
  elif pm2 describe sillytavern >/dev/null 2>&1; then pm2 restart sillytavern --update-env
  else echo "⚠️ Không tìm thấy SillyTavern trong PM2, hãy khởi động lại thủ công trong bảng điều khiển (aaPanel)"; fi
else echo "⚠️ Không phát hiện PM2, hãy khởi động lại SillyTavern thủ công trong bảng điều khiển (aaPanel)"; fi
