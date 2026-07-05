# Heading Rule Focus

- Source grade: `C:\Codex\a11y-agent\goal2-app\agents-cli\results\saga-a11y-local-grade.json`
- Heading failure cases: 4
- Heading failure instances: 7
- Shortage instances: 4
- Excess instances: 3
- Regressed instances: 2

## Metric Breakdown

| Metric | Total | Shortage | Excess | Regressed | Improved | Unchanged |
|---|---:|---:|---:|---:|---:|---:|
| h2 | 3 | 2 | 1 | 0 | 3 | 0 |
| h3 | 3 | 1 | 2 | 2 | 0 | 1 |
| h4 | 1 | 1 | 0 | 0 | 1 | 0 |

## Pattern Breakdown

| Pattern | Cases |
|---|---:|
| CMS componentization likely required first | 1 |
| Date-range content snapshot differs | 1 |
| Gold-only content update likely | 1 |
| Stale or out-of-scope section likely remains | 1 |

## Focused Rule Candidates

### Separate gold-only or time-sensitive content updates

- Rule id: `heading-content-snapshot-review`
- Evidence count: 3
- Case count: 3
- Implementation: Do not invent headings or delete dated sections only to match gold. Re-fetch the old page, compare publication dates, or send the case to human confirmation.
- Human check: Confirm whether gold contains newer content, a different date range, or an intentionally removed section before changing administrative content.

| Example case | Score | Diagnosis | Current | Gold | Failure keys |
|---|---:|---|---|---|---|
| saga-city/sg04007.html | 55.8765 | Current keeps a section that gold likely removed or moved. Do not delete it automatically; confirm page scope or content freshness first. | h2:2<br>h3:11<br>h4:0 | h2:8<br>h3:0<br>h4:0 | h2_shortage, h3_excess |
| saga-city/sg02395.html | 59.0689 | Current and gold contain different dated schedule ranges; re-fetch or confirm the target period instead of trimming date headings automatically. | h2:3<br>h3:17<br>h4:0 | h2:3<br>h3:8<br>h4:0 | h3_excess |
| saga-city/sg03997.html | 77.0243 | Gold has more body text/headings than old/current; do not create administrative content from nothing. Re-fetch the source or escalate as content update. | h2:4<br>h3:0<br>h4:0 | h2:5<br>h3:0<br>h4:0 | h2_shortage |

### Separate CMS componentization from heading-tag fixes

- Rule id: `heading-cms-componentization-review`
- Evidence count: 1
- Case count: 1
- Implementation: Treat card/link/video blocks as CMS components first; heading levels should be derived after component boundaries are known.
- Human check: Check the CMS parts expected for promotional cards, videos, and related-link blocks before adjusting heading levels.

| Example case | Score | Diagnosis | Current | Gold | Failure keys |
|---|---:|---|---|---|---|
| saga-city/sg06323.html | 75.8165 | Gold appears to split cards, video/link blocks, or promotional modules into components; decide component boundaries before heading-level fixes. | h2:10<br>h3:6<br>h4:6 | h2:9<br>h3:22<br>h4:8 | h2_excess, h3_shortage, h4_shortage |

## Priority Cases

| Case | Score | Diagnosis | Old | Current | Gold |
|---|---:|---|---|---|---|
| saga-city/sg04007.html | 55.8765 | Current keeps a section that gold likely removed or moved. Do not delete it automatically; confirm page scope or content freshness first. | h2:1<br>h3:2<br>h4:11 | h2:2<br>h3:11<br>h4:0 | h2:8<br>h3:0<br>h4:0 |
| saga-city/sg02395.html | 59.0689 | Current and gold contain different dated schedule ranges; re-fetch or confirm the target period instead of trimming date headings automatically. | h2:1<br>h3:5<br>h4:14 | h2:3<br>h3:17<br>h4:0 | h2:3<br>h3:8<br>h4:0 |
| saga-city/sg06323.html | 75.8165 | Gold appears to split cards, video/link blocks, or promotional modules into components; decide component boundaries before heading-level fixes. | h2:11<br>h3:6<br>h4:5 | h2:10<br>h3:6<br>h4:6 | h2:9<br>h3:22<br>h4:8 |
| saga-city/sg03997.html | 77.0243 | Gold has more body text/headings than old/current; do not create administrative content from nothing. Re-fetch the source or escalate as content update. | h2:0<br>h3:0<br>h4:0 | h2:4<br>h3:0<br>h4:0 | h2:5<br>h3:0<br>h4:0 |
