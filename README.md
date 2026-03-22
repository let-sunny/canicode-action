# CanICode Action

Figma design quality gate for CI. Analyze designs and enforce score thresholds before merging.

## Usage

```yaml
name: Design Quality Gate
on:
  pull_request:

jobs:
  design-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: let-sunny/canicode-action@v1
        with:
          figma_url: 'https://www.figma.com/design/ABC123/MyDesign?node-id=1-234'
          figma_token: ${{ secrets.FIGMA_TOKEN }}
          min_score: 70
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `figma_url` | Yes | — | Figma URL with `node-id` |
| `figma_token` | Yes | — | Figma API token |
| `min_score` | No | `60` | Minimum score to pass (0-100) |
| `preset` | No | `dev-friendly` | `relaxed` \| `dev-friendly` \| `ai-ready` \| `strict` |
| `comment` | No | `true` | Post results as PR comment |

## Outputs

| Output | Description |
|--------|-------------|
| `score` | Overall score (0-100) |
| `grade` | Grade (A/B/C/D/F) |
| `passed` | Whether score met threshold |
| `report_json` | Full analysis JSON |

## PR Comment

On pull requests, the action posts an analysis summary:

> ## ✅ CanICode Design Analysis — PASSED
>
> | Metric | Value |
> |--------|-------|
> | Score | **78%** (B) |
> | Threshold | 70% |
>
> | Category | Score |
> |----------|-------|
> | layout | 85% |
> | token | 72% |
> | naming | 68% |

Updated on each run — no duplicate comments.

## License

MIT
