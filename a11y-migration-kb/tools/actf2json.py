#!/usr/bin/env python3
"""
actf2json.py — eclipse-actf/org.eclipse.actf の公式チェック項目定義から
逆引き用JSONを生成する。

- vendor/eclipse-actf/checkitem.xml … チェック項目・WCAG 2.0対応表
- vendor/eclipse-actf/description_ja.properties … 日本語メッセージテンプレート
- reference/michecker-out-of-content-scope.json … 本文スコープ外の分類(任意)。
  存在する場合、各レコードに content_scope_note (理由文字列 or null) をマージする。

使い方:
  python3 tools/actf2json.py --bundle . --out build/michecker-checkitems.json
"""
import argparse
import codecs
import json
import re
from pathlib import Path

PROPERTY_RE = re.compile(r'^([^=]+?)\s*=\s*(.*)$')
CHECKITEM_RE = re.compile(r'<checkitem type="([^"]+)" id="([^"]+)">(.*?)</checkitem>', re.S)
WCAG20_RE = re.compile(r'<gItem\s+(?:techniques="([^"]*)"\s+)?id="([^"]+)"\s+name="WCAG 2.0"')


def load_properties(path):
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = PROPERTY_RE.match(line)
        if not m:
            continue
        key, val = m.group(1).strip(), m.group(2)
        out[key] = codecs.decode(val, "unicode_escape")
    return out


def normalize_whitespace(text):
    return re.sub(r"\s+", " ", text).strip()


def parse_checkitems(xml_text, desc_ja, scope_notes):
    records = []
    for typ, cid, body in CHECKITEM_RE.findall(xml_text):
        wcag20 = [
            {"criterion": criterion, "techniques": techniques or None}
            for techniques, criterion in WCAG20_RE.findall(body)
        ]
        desc = desc_ja.get(cid, "")
        desc_normalized = normalize_whitespace(desc)
        records.append({
            "id": cid,
            "type": typ,
            "wcag20": wcag20,
            "desc_ja": desc,
            "desc_ja_normalized": desc_normalized,
            "is_static": "{0}" not in desc_normalized,
            "content_scope_note": scope_notes.get(cid),
        })
    return records


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundle", default=".")
    ap.add_argument("--out", default="build/michecker-checkitems.json")
    args = ap.parse_args()

    bundle = Path(args.bundle)
    vendor = bundle / "vendor" / "eclipse-actf"
    xml_text = (vendor / "checkitem.xml").read_text(encoding="utf-8")
    desc_ja = load_properties(vendor / "description_ja.properties")

    scope_notes = {}
    scope_path = bundle / "reference" / "michecker-out-of-content-scope.json"
    if scope_path.exists():
        raw = json.loads(scope_path.read_text(encoding="utf-8"))
        scope_notes = {k: v for k, v in raw.items() if not k.startswith("_") and v}

    records = parse_checkitems(xml_text, desc_ja, scope_notes)

    out = bundle / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    static_count = sum(1 for r in records if r["is_static"])
    templated_count = len(records) - static_count
    distinct_wcag20 = {item["criterion"] for r in records for item in r["wcag20"]}
    scoped_out = sum(1 for r in records if r["content_scope_note"])
    print(f"生成: {len(records)} チェック項目 -> {out}")
    print(f"静的テキスト: {static_count} / テンプレート({{0}}あり): {templated_count}")
    print(f"distinct WCAG 2.0基準: {len(distinct_wcag20)}種")
    print(f"本文スコープ外: {scoped_out}件")


if __name__ == "__main__":
    main()
