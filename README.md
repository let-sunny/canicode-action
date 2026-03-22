# CanICode Action

> Like Lighthouse CI, but for Figma design quality.

Analyze Figma designs for development-readiness and enforce quality gates in your CI pipeline.

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

When triggered on a pull request, the action posts a comment like:

> ## ✅ CanICode Design Analysis — PASSED
>
> | Metric | Value |
> |--------|-------|
> | Score | **78%** (B) |
> | Threshold | 70% |
> | Nodes | 156 |
> | Issues | 23 (blocking: 0, risk: 5) |

The comment is updated on subsequent runs (no duplicates).

## Presets

| Preset | Description |
|--------|-------------|
| `relaxed` | Lenient scoring, fewer rules |
| `dev-friendly` | Balanced (default) |
| `ai-ready` | Stricter, optimized for AI code generation |
| `strict` | Maximum strictness |

## License

MIT
