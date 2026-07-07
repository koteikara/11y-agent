#!/usr/bin/env python3
"""
okf2jsonl.py — OKFバンドルの migration-rule 概念から JSONL ルール基盤を生成する。

- rules/<category>/<id>.md を走査
- YAMLフロントマター + 本文「# 例」内の before/after フェンスを抽出
- 1ルール = 1 JSONL レコード（example は配列で内包）

使い方:
  python tools/okf2jsonl.py --bundle . --out build/rules.jsonl
"""
import argparse, json, re, sys
from pathlib import Path

FM_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.S)

def parse_frontmatter(text):
    m = FM_RE.match(text)
    if not m:
        return {}, text
    raw, body = m.group(1), m.group(2)
    fm = {}
    key = None
    for line in raw.split("\n"):
        if not line.strip():
            continue
        m2 = re.match(r"^([A-Za-z_][\w]*):\s*(.*)$", line)
        if m2:
            key, val = m2.group(1), m2.group(2).strip()
            fm[key] = parse_scalar(val)
        elif line.lstrip().startswith("- ") and key:
            # YAML block list continuation
            if not isinstance(fm.get(key), list):
                fm[key] = []
            fm[key].append(parse_scalar(line.lstrip()[2:].strip()))
    return fm, body

def parse_scalar(v):
    v = v.strip()
    if v == "":
        return ""
    if v.startswith("[") and v.endswith("]"):
        inner = v[1:-1].strip()
        if not inner:
            return []
        return [parse_scalar(x) for x in split_top(inner)]
    if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
        return v[1:-1]
    if v in ("true", "True"): return True
    if v in ("false", "False"): return False
    return v

def split_top(s):
    out, depth, cur = [], 0, ""
    for ch in s:
        if ch == "[": depth += 1
        if ch == "]": depth -= 1
        if ch == "," and depth == 0:
            out.append(cur); cur = ""
        else:
            cur += ch
    if cur.strip():
        out.append(cur)
    return out

CASE_RE = re.compile(r"^##\s+ケース\d+:\s*(.+?)\s*$", re.M)
FENCE_RE = re.compile(r"```(before|after)\s*\n(.*?)\n```", re.S)
POINT_RE = re.compile(r"^ポイント[:：]\s*(.+?)\s*$", re.M)

def extract_examples(body):
    # 「# 例」セクションを切り出し
    m = re.search(r"^#\s*例\s*$(.*?)(?=^#\s|\Z)", body, re.S | re.M)
    if not m:
        return []
    section = m.group(1)
    examples = []
    cases = list(CASE_RE.finditer(section))
    for i, c in enumerate(cases):
        start = c.end()
        end = cases[i+1].start() if i+1 < len(cases) else len(section)
        chunk = section[start:end]
        fences = {kind: txt.strip() for kind, txt in FENCE_RE.findall(chunk)}
        pt = POINT_RE.search(chunk)
        examples.append({
            "case": c.group(1).strip(),
            "before": fences.get("before", ""),
            "after": fences.get("after", ""),
            "point": pt.group(1).strip() if pt else "",
        })
    return examples

def first_heading_rule(body):
    m = re.search(r"^#\s*必須ルール\s*$(.*?)(?=^#\s|\Z)", body, re.S | re.M)
    return m.group(1).strip() if m else ""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundle", default=".")
    ap.add_argument("--out", default="build/rules.jsonl")
    args = ap.parse_args()
    bundle = Path(args.bundle)
    rules_dir = bundle / "rules"
    records = []
    for md in sorted(rules_dir.rglob("*.md")):
        if md.name == "index.md":
            continue
        fm, body = parse_frontmatter(md.read_text(encoding="utf-8"))
        if fm.get("type") != "migration-rule":
            continue
        rel = md.relative_to(rules_dir)
        category = rel.parts[0]
        rec = {
            "id": str(rel.with_suffix("")).replace("/", "."),
            "category": category,
            "title": fm.get("title", ""),
            "description": fm.get("description", ""),
            "processing_class": fm.get("processing_class", ""),
            "wcag": fm.get("wcag", []),
            "jis": fm.get("jis", []),
            "municipality_specific": fm.get("municipality_specific", False),
            "cms_auto": fm.get("cms_auto", False),
            "known_failure": fm.get("known_failure", None),
            "origin": fm.get("origin", "kb"),
            "michecker_check_ids": fm.get("michecker_check_ids", []),
            "rule": first_heading_rule(body),
            "examples": extract_examples(body),
            "source": fm.get("resource", ""),
        }
        records.append(rec)
    out = bundle / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    # サマリ
    by_cat, by_pc = {}, {}
    for r in records:
        by_cat[r["category"]] = by_cat.get(r["category"], 0) + 1
        by_pc[r["processing_class"]] = by_pc.get(r["processing_class"], 0) + 1
    print(f"生成: {len(records)} ルール -> {out}")
    print("カテゴリ別:", json.dumps(by_cat, ensure_ascii=False))
    print("処理分類別:", json.dumps(by_pc, ensure_ascii=False))
    print("例の総数:", sum(len(r["examples"]) for r in records))

if __name__ == "__main__":
    main()
