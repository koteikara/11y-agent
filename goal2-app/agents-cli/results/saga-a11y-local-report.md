# agents-cli Local Evaluation Report

- Dataset: `C:\Codex\a11y-agent\goal2-app\agents-cli\datasets\saga-a11y-eval.jsonl`
- Cases: 51
- Average score: 94.6738
- Text similarity: 0.9165 -> 0.9223 (+0.0058)
- Improved metrics: 1
- Regressed metrics: 0
- Structural differs from gold: 11

## Metric Summary

| Metric | Matches gold | Improved | Regressed | Other differs |
|---|---:|---:|---:|---:|
| h2 | 50 | 1 | 0 | 0 |
| h3 | 51 | 0 | 0 | 0 |
| h4 | 51 | 0 | 0 | 0 |
| table | 51 | 0 | 0 | 0 |
| thead | 51 | 0 | 0 | 0 |
| caption | 51 | 0 | 0 | 0 |
| th | 51 | 0 | 0 | 0 |
| scopeCol | 51 | 0 | 0 | 0 |
| scopeRow | 51 | 0 | 0 | 0 |
| img | 50 | 0 | 0 | 1 |
| emptyAlt | 51 | 0 | 0 | 0 |
| iframe | 51 | 0 | 0 | 0 |
| weakLink | 42 | 0 | 0 | 9 |

## Worst Cases

- saga-city/sg03997.html: score=77.0243, similarity=0.6684, differs=1, regressed=0
- saga-city/sg04007.html: score=87.274, similarity=0.8392, differs=1, regressed=0
- saga-city/sg02558.html: score=88.7912, similarity=0.8645, differs=1, regressed=0
- saga-city/sg03727.html: score=89.3369, similarity=0.8736, differs=1, regressed=0
- saga-city/sg02571.html: score=89.5073, similarity=0.8764, differs=1, regressed=0
- saga-city/sg02565.html: score=90.3231, similarity=0.89, differs=1, regressed=0
- saga-city/sg02539.html: score=90.506, similarity=0.893, differs=1, regressed=0
- saga-city/sg01171.html: score=91.3649, similarity=0.9074, differs=1, regressed=0
- saga-city/sg00761.html: score=91.4231, similarity=0.9083, differs=1, regressed=0
- saga-city/sg02555.html: score=91.5003, similarity=0.9096, differs=1, regressed=0
