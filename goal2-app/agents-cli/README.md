# Goal2 agents-cli Evaluation Workspace

This folder prepares Goal2 for `google/agents-cli` style evaluation.

The current implementation is intentionally local-first:

- no Google Cloud project is required
- no Gemini API key is required
- no customer data leaves the workspace
- the outputs are shaped so they can later be connected to `agents-cli eval generate` and `agents-cli eval grade`

## Quick Start

```bash
npm run agents:bootstrap
```

This creates:

- `datasets/saga-a11y-eval.jsonl`
- `datasets/saga-a11y-eval.json`
- `results/saga-a11y-local-traces.jsonl`
- `results/saga-a11y-local-grade.json`
- `results/saga-a11y-local-report.md`
- `results/saga-a11y-local-analysis.json`
- `results/saga-a11y-local-analysis.md`
- `results/saga-a11y-table-rule-focus.json`
- `results/saga-a11y-table-rule-focus.md`
- `results/saga-a11y-heading-rule-focus.json`
- `results/saga-a11y-heading-rule-focus.md`

## Commands

```bash
npm run agents:dataset
npm run agents:local-eval
npm run agents:analyze
npm run agents:analyze:tables
npm run agents:analyze:headings
```

Use a limited dataset while iterating:

```bash
node tools/build-agents-cli-dataset.js --limit 10 --pretty
node tools/run-agents-cli-local-eval.js
node tools/analyze-agents-cli-results.js
node tools/analyze-table-rule-focus.js
node tools/analyze-heading-rule-focus.js
```

## Dataset Shape

Each JSONL record contains:

- `id`: stable case id
- `task`: Goal2 task name
- `prompt`: migration/a11y instruction text
- `input.old_html`: source HTML
- `expected.gold_html`: target gold HTML
- `metadata`: municipality, source file, scope, and evaluation focus

## Local Trace Shape

Each trace record contains:

- `id`
- `output_html`
- `comparison`
- `metrics`
- `failures`

This mirrors the artifacts we need from an eventual `agents-cli eval generate` + `agents-cli eval grade` run.

## Failure Analysis Shape

`npm run agents:analyze` reads `results/saga-a11y-local-grade.json` and creates:

- category summaries: heading, table, image/media, link text
- metric summaries: h2, caption, scopeRow, weakLink, and others
- priority cases: the pages with the largest gold differences
- recommended actions: the next rule family to improve

## Table Rule Focus

`npm run agents:analyze:tables` narrows table failures into:

- shortage vs excess for `table`, `caption`, `thead`, `th`, `scopeCol`, and `scopeRow`
- rule candidates such as data-table preservation, per-table upgrade, over-upgrade prevention, caption inference, and scope distribution
- priority cases with old/current/gold metric counts

## Heading Rule Focus

`npm run agents:analyze:headings` narrows heading failures into:

- shortage vs excess for `h2`, `h3`, and `h4`
- patterns such as lower-level promotion, over-flattening, missing nested depth, semantic heading shortage, and template/navigation leftovers
- focused rule candidates with implementation notes and human-check boundaries

## Next agents-cli Step

After `uvx google-agents-cli setup` and authentication are available, scaffold an ADK wrapper agent that:

1. accepts `old_html`
2. calls Goal2 candidate generation or equivalent tool functions
3. returns `current_html` and evidence JSON
4. runs against `datasets/saga-a11y-eval.jsonl`

Do not send non-public customer data to external services without project approval.
