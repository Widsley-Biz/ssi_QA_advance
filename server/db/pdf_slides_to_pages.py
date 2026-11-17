#!/usr/bin/env python3
"""スライドPDFを1ページ=1枚のJPEGに分割し、GCSにアップロードする。

スライド教材はAirCourseから画像のみのPDF（テキスト層なし）としてエクスポートされる
ことが多く、その場合はPDF全体をクライアントに読ませるより、最初から1ページ単位の
画像にしてしまう方が軽く、ページ単位の視聴進捗も取りやすい。

    python3 server/db/pdf_slides_to_pages.py \
        --material-id jstqb-fl-ch01-lecture \
        --bucket widsley-skillcheck-materials --prefix jstqb-fl \
        "01_テストの基礎.pdf"

出力は gs://<bucket>/<prefix>/<material-id>/001.jpg, 002.jpg, ... となる。
変換後のページ数を標準出力に出す（exams.materials の pages 列に使う）。
"""

from __future__ import annotations

import argparse
import contextlib
import subprocess
import sys
import tempfile
from pathlib import Path


def convert(pdf_path: Path, work_dir: Path, dpi: int) -> list[Path]:
    subprocess.run(
        [
            "pdftoppm", "-jpeg", "-r", str(dpi), "-jpegopt", "quality=80",
            str(pdf_path), str(work_dir / "page"),
        ],
        check=True,
    )
    pages = sorted(work_dir.glob("page-*.jpg"))
    if not pages:
        raise RuntimeError(f"pdftoppmの出力が見つかりません: {work_dir}")
    renamed: list[Path] = []
    for i, p in enumerate(pages, start=1):
        dest = work_dir / f"{i:03d}.jpg"
        p.rename(dest)
        renamed.append(dest)
    return renamed


def upload(work_dir: Path, bucket: str, prefix: str, material_id: str) -> None:
    dest = f"gs://{bucket}/{prefix}/{material_id}/"
    subprocess.run(
        ["gcloud", "storage", "cp", str(work_dir / "*.jpg"), dest],
        check=True,
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf", type=Path)
    ap.add_argument("--material-id", required=True)
    ap.add_argument("--bucket", required=True)
    ap.add_argument("--prefix", required=True)
    ap.add_argument("--no-upload", action="store_true", help="変換のみ行い、アップロードはしない")
    ap.add_argument("--dpi", type=int, default=100, help="pdftoppmの解像度（既定100）")
    ap.add_argument(
        "--out-dir", type=Path, default=None,
        help="変換結果を残すディレクトリ（--no-uploadで中身を確認したいときに使う。"
             "指定しない場合は一時ディレクトリに変換してアップロード後に消える）",
    )
    args = ap.parse_args()

    work_dir_cm = (
        contextlib.nullcontext(args.out_dir)
        if args.out_dir is not None
        else tempfile.TemporaryDirectory()
    )
    if args.out_dir is not None:
        args.out_dir.mkdir(parents=True, exist_ok=True)

    with work_dir_cm as tmp:
        work_dir = Path(tmp)
        pages = convert(args.pdf, work_dir, args.dpi)
        print(f"{args.pdf.name}: {len(pages)}ページ ({args.dpi}dpi)")
        if not args.no_upload:
            upload(work_dir, args.bucket, args.prefix, args.material_id)
            print(f"アップロード完了: gs://{args.bucket}/{args.prefix}/{args.material_id}/")
        elif args.out_dir is not None:
            print(f"変換結果: {work_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
