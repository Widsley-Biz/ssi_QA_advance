#!/usr/bin/env python3
"""AirCourse からエクスポートした設問CSVを exam_questions のマイグレーションSQLに変換する。

AirCourse の API では設問を取得できないため（ユーザー・組織・グループのAPIのみ）、
管理画面からダウンロードしたCSVをこのスクリプトで取り込む。

    python3 supabase/tools/import_aircourse_csv.py \
        --exam-id playwright-mock-a --exam-name "Playwright模擬筆記 セットA" \
        --pass-score 65 --out supabase/migrations/011_exam_playwright.sql \
        ~/Downloads/"セット A_20260818185626.csv"

複数セットをまとめて1ファイルにする場合は --append を使う。

## CSVの形式（AirCourseのエクスポート）

  question_name           問題1-1【locator】チェックボックスの取得
  question_text           HTML。問題文 + コードブロック + 選択肢
  question_type           multiple
  correct_answer          C  /  複数正解なら A;D
  feedback_text           HTML。解説
  score_weight_point      5   ← 傾斜配点
  m_answer_number         4
  m_answer_text           A;B;C;D（ラベルのみ。本文は question_text の中）
  m_allow_multiple_answer T / F

選択肢の本文は question_text の末尾に埋め込まれており、2通りのレイアウトがある。

  レイアウト1（1行1選択肢）
    <p>A. xxx<br>B. yyy<br>C. zzz<br>D. www</p>

  レイアウト2（選択肢がコードブロック）
    <p>A. </p><div><div>code...</div></div><p><br>B.</p><div>...</div> ...
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import sys
from pathlib import Path

# 残す HTML タグ。AirCourse のエディタが入れる style / span は落とす
# table系はJSTQB問題の決定表・見積り表のような構造化された設問に必要
KEEP_TAGS = {
    "p", "br", "pre", "code", "strong", "em", "b", "i", "ul", "ol", "li",
    "table", "thead", "tbody", "tr", "td", "th",
}


def strip_styling(fragment: str) -> str:
    """色付けの span と style 属性を落として、意味のあるタグだけ残す。"""
    # <span ...>text</span> → text
    fragment = re.sub(r"</?span[^>]*>", "", fragment)
    # 残ったタグから style / class を落とす
    fragment = re.sub(r'\s+(style|class)="[^"]*"', "", fragment)

    def drop_unknown(m: re.Match[str]) -> str:
        tag = m.group(2).lower()
        return m.group(0) if tag in KEEP_TAGS else ""

    return re.sub(r"<(/?)([a-zA-Z0-9]+)[^>]*>", drop_unknown, fragment)


def div_block_to_text(fragment: str) -> str:
    """<div><div>行</div><div>行</div></div> 形式のコードを改行区切りのテキストにする。"""
    fragment = re.sub(r"</?span[^>]*>", "", fragment)
    # タグ間の改行・インデントを先に落とす。これをしないと </div> 由来の改行と
    # ソースの改行が重なって、コード1行ごとに空行が入ってしまう
    fragment = re.sub(r">\s+<", "><", fragment)
    fragment = re.sub(r"</div>", "\n", fragment, flags=re.I)
    fragment = re.sub(r"<[^>]+>", "", fragment)
    text = html.unescape(fragment)
    lines = [ln.rstrip() for ln in text.split("\n")]
    # 連続する空行を1つに畳み、前後の空行を落とす
    out: list[str] = []
    for ln in lines:
        if not ln.strip() and (not out or not out[-1].strip()):
            continue
        out.append(ln)
    while out and not out[-1].strip():
        out.pop()
    return "\n".join(out)


def parse_choices(question_text: str, expected: int) -> tuple[str, dict[str, str]]:
    """question_text を (選択肢を除いた問題文HTML, {キー: 選択肢本文}) に分解する。"""
    # --- レイアウト1: 末尾の <p> に A. 〜 D. が <br> 区切りで並ぶ
    paragraphs = list(re.finditer(r"<p>(.*?)</p>", question_text, re.S))
    if paragraphs:
        last = paragraphs[-1]
        parts = re.split(r"<br\s*/?>", last.group(1))
        found: dict[str, str] = {}
        for part in parts:
            m = re.match(r"\s*([A-Z])\s*[.．、]\s*(.*)$", part, re.S)
            if m:
                found[m.group(1).lower()] = html.unescape(
                    re.sub(r"<[^>]+>", "", m.group(2))
                ).strip()
        if len(found) == expected:
            body = question_text[: last.start()] + question_text[last.end() :]
            return strip_styling(body).strip(), found

    # --- レイアウト2: <p>A. </p> の直後に <div> のコードブロックが続く
    markers = list(
        re.finditer(r"<p>\s*(?:<br\s*/?>)?\s*([A-Z])\s*[.．、]?\s*</p>", question_text)
    )
    if len(markers) == expected:
        found = {}
        for i, mk in enumerate(markers):
            start = mk.end()
            end = markers[i + 1].start() if i + 1 < len(markers) else len(question_text)
            found[mk.group(1).lower()] = div_block_to_text(question_text[start:end])
        body = question_text[: markers[0].start()]
        return strip_styling(body).strip(), found

    raise ValueError(f"選択肢を{expected}件抽出できませんでした")


def choices_from_answer_text(answer_text: str, correct_answer: str) -> tuple[dict[str, str], list[str]]:
    """選択肢がquestion_text内に埋め込まれていない形式（JSTQB系の出力）向け。

    この形式ではm_answer_textに選択肢の本文がそのまま ; 区切りで入っており、
    correct_answerも（A/B/C/Dのキーではなく）選択肢本文の完全一致で入っている。
    """
    options = [html.unescape(o).strip() for o in answer_text.split(";") if o.strip()]
    choices = {chr(ord("a") + i): opt for i, opt in enumerate(options)}

    correct_keys: list[str] = []
    for c in (html.unescape(x).strip() for x in correct_answer.split(";") if x.strip()):
        matches = [k for k, v in choices.items() if v == c]
        if not matches:
            raise ValueError(f"正解 {c!r} が選択肢 {list(choices.values())} と一致しません")
        correct_keys.append(matches[0])
    return choices, correct_keys


def sql_str(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def sql_text_array(keys: list[str]) -> str:
    return "'{" + ",".join(keys) + "}'"


def convert(path: Path) -> list[dict]:
    rows = list(csv.DictReader(path.open(encoding="utf-8-sig")))
    out: list[dict] = []
    for i, row in enumerate(rows, start=1):
        expected = int(row["m_answer_number"])
        try:
            question, choices = parse_choices(row["question_text"], expected)
            correct = [k.strip().lower() for k in row["correct_answer"].split(";") if k.strip()]
            missing = [k for k in correct if k not in choices]
            if missing:
                raise ValueError(f"正解キー {missing} が選択肢に無い")
        except ValueError:
            # 選択肢がquestion_text内に埋め込まれていない形式（JSTQB系）にフォールバック
            question = strip_styling(row["question_text"]).strip()
            choices, correct = choices_from_answer_text(row["m_answer_text"], row["correct_answer"])
        cat = re.search(r"【(.+?)】", row["question_name"])
        # score_weight_pointが0（未設定）のCSVは均等配点（5点）を既定にする
        points = int(row["score_weight_point"]) or 5
        out.append(
            {
                "no": i,
                "name": row["question_name"],
                "category": cat.group(1) if cat else "",
                "question": question,
                "choices": choices,
                "correct_keys": correct,
                "allow_multiple": row["m_allow_multiple_answer"].strip().upper() == "T"
                or len(correct) > 1,
                "explanation": strip_styling(row["feedback_text"]).strip(),
                "points": points,
            }
        )
    return out


def emit_sql(exam_id: str, exam_name: str, pass_score: int, questions: list[dict],
             sort_order: int, group_name: str = "", time_limit_min: int | None = None,
             unlimited_retake: bool = True) -> str:
    total = sum(q["points"] for q in questions)
    retake_note = "何度でも受け直せます。" if unlimited_retake else "受験回数・対象者は別途制限されます。"
    time_note = f"制限時間{time_limit_min}分。" if time_limit_min else ""
    lines = [
        f"-- {exam_name}（{len(questions)}問 / 満点{total}点 / 合格ライン{pass_score}点）",
        "DELETE FROM exam_questions WHERE exam_id = " + sql_str(exam_id) + ";",
        "INSERT INTO exams (id, name, description, group_name, pass_score, time_limit_min,",
        "                   shuffle_questions, is_published, sort_order) VALUES",
        f"  ({sql_str(exam_id)}, {sql_str(exam_name)},",
        f"   {sql_str(f'全{len(questions)}問・満点{total}点。合格ライン{pass_score}点。{time_note}{retake_note}')},",
        f"   {sql_str(group_name)},",
        f"   {pass_score}, {time_limit_min if time_limit_min else 'NULL'}, true,"
        f" {'false' if not unlimited_retake else 'true'}, {sort_order})",
        "ON CONFLICT (id) DO UPDATE SET",
        "  name = EXCLUDED.name, description = EXCLUDED.description,",
        "  group_name = EXCLUDED.group_name, pass_score = EXCLUDED.pass_score,",
        "  time_limit_min = EXCLUDED.time_limit_min,",
        "  sort_order = EXCLUDED.sort_order;",
        "-- is_publishedはここでは更新しない。既に管理画面で公開/非公開を設定している場合に",
        "-- 再投入のたびへ戻ってしまうのを防ぐ（新規作成時だけ上のVALUESの初期値が使われる）",
        "",
        "INSERT INTO exam_questions",
        "  (exam_id, no, category, question, choices, correct_keys, allow_multiple,",
        "   explanation, points) VALUES",
    ]
    values = []
    for q in questions:
        values.append(
            "  ("
            + sql_str(exam_id)
            + f", {q['no']}, "
            + sql_str(q["category"])
            + ",\n   "
            + sql_str(q["question"])
            + ",\n   "
            + sql_str(json.dumps(q["choices"], ensure_ascii=False))
            + "::jsonb, "
            + sql_text_array(q["correct_keys"])
            + f", {str(q['allow_multiple']).lower()},\n   "
            + sql_str(q["explanation"])
            + f", {q['points']})"
        )
    lines.append(",\n".join(values) + ";")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv", nargs="+", type=Path)
    ap.add_argument("--exam-id", required=True, help="複数CSVのときは接尾辞 -a -b ... が付く")
    ap.add_argument("--exam-name", required=True)
    ap.add_argument("--pass-score", type=int, required=True)
    ap.add_argument("--group-name", default="", help="一覧でまとめるジャンル名（例: 社内認定試験）")
    ap.add_argument("--time-limit-min", type=int, default=None, help="制限時間（分）。省略時は制限なし")
    ap.add_argument(
        "--limited-retake", action="store_true",
        help="正式試験向け：説明文を「何度でも受け直せます」ではなく「回数・対象者は別途制限」にする",
    )
    ap.add_argument("--out", type=Path)
    ap.add_argument("--json-out", type=Path)
    args = ap.parse_args()

    chunks: list[str] = [
        "-- ============================================================",
        f"-- {args.exam_name} の設問",
        "-- ============================================================",
        "-- AirCourse からエクスポートしたCSVを",
        "--   server/db/import_aircourse_csv.py",
        "-- で変換したもの。手で編集せず、CSVを直してから再生成すること。",
        "-- ============================================================",
        "",
    ]
    all_json = {}
    multi = len(args.csv) > 1
    for idx, path in enumerate(sorted(args.csv)):
        label = re.search(r"セット\s*([A-Z])", path.name)
        suffix = (label.group(1).lower() if label else chr(ord("a") + idx)) if multi else ""
        exam_id = f"{args.exam_id}-{suffix}" if suffix else args.exam_id
        exam_name = f"{args.exam_name} セット{suffix.upper()}" if suffix else args.exam_name
        try:
            questions = convert(path)
        except ValueError as e:
            print(f"NG {path.name}: {e}", file=sys.stderr)
            return 1
        total = sum(q["points"] for q in questions)
        print(f"OK {path.name} → {exam_id}: {len(questions)}問 / {total}点")
        chunks.append(emit_sql(
            exam_id, exam_name, args.pass_score, questions, idx + 1,
            group_name=args.group_name, time_limit_min=args.time_limit_min,
            unlimited_retake=not args.limited_retake,
        ))
        all_json[exam_id] = {"name": exam_name, "total_points": total, "questions": questions}

    sql = "\n".join(chunks)
    if args.out:
        args.out.write_text(sql, encoding="utf-8")
        print(f"書き出し: {args.out}")
    else:
        print(sql)
    if args.json_out:
        args.json_out.write_text(
            json.dumps(all_json, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"書き出し: {args.json_out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
