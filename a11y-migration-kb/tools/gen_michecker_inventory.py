#!/usr/bin/env python3
"""Generate goal2-app/MICHECKER_PORT_INVENTORY.md from the eclipse-actf source analysis.

One-shot analysis script for PR-M0 of the miChecker engine port
(see goal2-app/MICHECKER_ENGINE_PORT_INSTRUCTIONS.md). Not part of the
runtime build; re-run manually if the vendor/eclipse-actf source is updated.

Usage (from anywhere; paths below are repo-relative regardless of cwd):
    git clone --depth 1 https://github.com/eclipse-actf/org.eclipse.actf.git /tmp/actf-src
    python3 a11y-migration-kb/tools/gen_michecker_inventory.py /tmp/actf-src \\
        > goal2-app/MICHECKER_PORT_INVENTORY.md
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def load_items():
    items = {}
    for l in open(f"{ROOT}/goal2-app/data/michecker-checkitems.json"):
        if l.strip():
            d = json.loads(l)
            items[d["id"]] = d
    return items


def load_out_of_scope():
    oos = json.load(open(f"{ROOT}/a11y-migration-kb/reference/michecker-out-of-content-scope.json"))
    return {k for k in oos if k.startswith("C_")}


def load_rule_by_checkid():
    rule_by_checkid = defaultdict(list)
    for l in open(f"{ROOT}/goal2-app/data/rules.jsonl"):
        if not l.strip():
            continue
        r = json.loads(l)
        rule_id = r.get("id") or r.get("path")
        for cid in (r.get("michecker_check_ids") or []):
            rule_by_checkid[cid].append(rule_id)
    return rule_by_checkid


def parse_check_engine(actf_src_dir):
    src_path = f"{actf_src_dir}/org.eclipse.actf.validation.html/src/org/eclipse/actf/validation/html/internal/CheckEngine.java"
    lines = open(src_path).read().split("\n")
    method_re = re.compile(r'^\t(?:private|public|protected)\s+(?:static\s+)?[\w<>\[\], .]+\s+(\w+)\s*\(')
    cur = "?"
    line_method = []
    for ln in lines:
        m = method_re.match(ln)
        if m:
            cur = m.group(1)
        line_method.append(cur)

    id_re = re.compile(r'"(C_\d+\.\d+)"')
    first_site = {}
    for idx, ln in enumerate(lines):
        for cid in id_re.findall(ln):
            if cid not in first_site:
                first_site[cid] = (line_method[idx], idx + 1)

    tc_related = set()
    for i, ln in enumerate(lines):
        if "checker.checkAlt" in ln or "TextCheckResult" in ln:
            window = lines[max(0, i - 5):i + 40]
            for w in window:
                tc_related.update(re.findall(r'"(C_\d+\.\d+)"', w))

    return first_site, tc_related


CSS_DEPENDENT = {
    "C_8.0", "C_33.0", "C_33.1", "C_33.2",
    "C_500.17", "C_500.18", "C_500.19", "C_500.20", "C_500.21",
}
NOT_FIRED = {"C_16.0", "C_332.0"}

CLASS_LABEL = {
    "pure-dom": "pure-DOM",
    "always-checklist": "手動確認(always)",
    "css-text-analysis": "テキストCSS解析",
    "textchecker-dependent": "TextChecker依存",
    "not-fired": "本体未発火",
}

PR_BY_TYPE = {"error": "M1", "warning": "M2", "info": "M3", "user": "M3"}


def classify(cid, first_site, tc_related):
    if cid in NOT_FIRED:
        return "not-fired"
    if cid in CSS_DEPENDENT:
        return "css-text-analysis"
    if cid in tc_related:
        return "textchecker-dependent"
    method = first_site.get(cid, (None,))[0]
    if method == "always":
        return "always-checklist"
    return "pure-dom"


def truncate(text, n=60):
    text = text.replace("\n", " ").strip()
    return text if len(text) <= n else text[:n - 1] + "…"


def main():
    actf_src_dir = sys.argv[1] if len(sys.argv) > 1 else "/tmp/actf-src"
    items = load_items()
    oos_ids = load_out_of_scope()
    rule_by_checkid = load_rule_by_checkid()
    first_site, tc_related = parse_check_engine(actf_src_dir)

    in_scope = sorted(
        set(items) - oos_ids,
        key=lambda x: [int(p) for p in x[2:].split(".")],
    )

    rows = []
    for cid in in_scope:
        item = items[cid]
        cls = classify(cid, first_site, tc_related)
        method, lineno = first_site.get(cid, ("―", None))
        loc = f"{method} (L{lineno})" if lineno else "―"
        rules = rule_by_checkid.get(cid) or []
        pr = "対象外" if cls == "not-fired" else PR_BY_TYPE.get(item["type"], "?")
        rows.append({
            "id": cid,
            "type": item["type"],
            "desc": truncate(item["desc_ja"]),
            "loc": loc,
            "cls": CLASS_LABEL[cls],
            "rules": ", ".join(f"`{r}`" for r in rules) if rules else "―",
            "pr": pr,
        })

    from collections import Counter
    type_counts = Counter(r["type"] for r in rows)
    cls_counts = Counter(r["cls"] for r in rows)

    print("# MICHECKER_PORT_INVENTORY.md")
    print()
    print("miChecker公式判定エンジン(CheckEngine.java)移植の対象チェック項目インベントリ。")
    print("`goal2-app/MICHECKER_ENGINE_PORT_INSTRUCTIONS.md` §5 PR-M0の成果物。")
    print("`tools/gen_michecker_inventory.py`で自動生成(手動編集しないこと。vendorソース更新時は再生成する)。")
    print()
    print("## 集計")
    print()
    print(f"- 対象合計: **{len(rows)}件**(公式268件 − スコープ外152件)")
    print(f"- type別: " + " / ".join(f"{k} {v}" for k, v in sorted(type_counts.items())))
    print(f"- 移植可否分類別: " + " / ".join(f"{k} {v}" for k, v in sorted(cls_counts.items())))
    print()
    print("## 一覧")
    print()
    print("| チェックID | type | 内容(要約) | CheckEngine.java担当 | 分類 | 対応KBルール | 実装PR |")
    print("|---|---|---|---|---|---|---|")
    for r in rows:
        print(f"| {r['id']} | {r['type']} | {r['desc']} | {r['loc']} | {r['cls']} | {r['rules']} | {r['pr']} |")


if __name__ == "__main__":
    main()
