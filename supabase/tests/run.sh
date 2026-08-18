#!/usr/bin/env bash
# supabase/migrations を一時的なローカル PostgreSQL に適用して検証する。
# 本番Supabaseには一切触らない。
#
#   brew install postgresql@17
#   supabase/tests/run.sh
#
# 使い終わったクラスタは自動で停止する。データディレクトリは
# $TMPDIR 配下に残るので、不要になったら手動で消すこと（このスクリプトは削除しない）。

set -euo pipefail

PGBIN=${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}
# 空いているポートを探す（他のクラスタと衝突しないように）
find_port() {
  local p=${PORT:-55432}
  while [ $p -lt 55500 ]; do
    if ! nc -z 127.0.0.1 "$p" >/dev/null 2>&1; then echo "$p"; return; fi
    p=$((p+1))
  done
  echo "空きポートが見つかりません" >&2; exit 1
}
HERE="$(cd "$(dirname "$0")" && pwd)"
MIG="$HERE/../migrations"

if [ ! -x "$PGBIN/initdb" ]; then
  echo "PostgreSQL が見つかりません: $PGBIN" >&2
  echo "brew install postgresql@17 を実行するか、PGBIN を指定してください" >&2
  exit 1
fi
export PATH="$PGBIN:$PATH"

PORT=$(find_port)
DATADIR=$(mktemp -d "${TMPDIR:-/tmp}/scpg.XXXXXX")
echo "ポート: $PORT"
echo "データディレクトリ: $DATADIR"

cleanup() {
  pg_ctl -D "$DATADIR/data" stop -m fast >/dev/null 2>&1 || true
  echo "クラスタを停止しました（$DATADIR は残しています）"
}
trap cleanup EXIT

initdb -D "$DATADIR/data" -U postgres --auth=trust >/dev/null
# ソケットパスが長すぎるとエラーになるため TCP で待ち受ける
pg_ctl -D "$DATADIR/data" -o "-p $PORT -h 127.0.0.1 -k /tmp" -l "$DATADIR/log" start >/dev/null \
  || { echo "起動に失敗しました。ログ: $DATADIR/log" >&2; tail -5 "$DATADIR/log" >&2; exit 1; }
sleep 3

psql() { command psql -h 127.0.0.1 -p "$PORT" -U postgres "$@"; }

psql -q -c "CREATE DATABASE sc;"
PSQL_DB=(-d sc -q -v ON_ERROR_STOP=1)

echo "--- 依存部分のスタブを投入 ---"
psql "${PSQL_DB[@]}" -f "$HERE/00_stub.sql" >/dev/null

echo "--- マイグレーション 010 を適用 ---"
psql "${PSQL_DB[@]}" -f "$MIG/010_exams.sql" >/dev/null
echo "適用OK"

echo
echo "===== 機能テスト ====="
command psql -h 127.0.0.1 -p "$PORT" -U postgres -d sc -v ON_ERROR_STOP=1 \
  -f "$HERE/10_exams_test.sql" 2>&1 \
  | grep -E "OK:|FAIL|ERROR|パス|獲得点|問別|出題順" | sed 's|^psql:.*NOTICE:  ||'

echo
echo "===== RLSテスト ====="
command psql -h 127.0.0.1 -p "$PORT" -U postgres -d sc -v ON_ERROR_STOP=1 \
  -f "$HERE/11_exams_rls_test.sql" 2>&1 \
  | grep -E "OK:|FAIL|ERROR|完了" | sed 's|^psql:.*NOTICE:  ||'

echo
echo "すべて完了（FAIL / ERROR の行が無ければ全項目パス）"
