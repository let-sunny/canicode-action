# CanICode Action

Figma design quality gate for CI. Analyze designs and enforce score thresholds before merging.

## Usage

Extract the Figma URL from the PR body automatically:

```yaml
name: Design Quality Gate
on:
  pull_request:

jobs:
  design-check:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - name: Extract Figma URL from PR body
        id: figma
        uses: actions/github-script@v7
        with:
          script: |
            const body = context.payload.pull_request.body || '';
            const match = body.match(/https:\/\/www\.figma\.com\/design\/[^\s)]+/);
            if (!match) {
              core.notice('No Figma URL found in PR body — skipping design check');
              core.setOutput('skip', 'true');
              return;
            }
            core.setOutput('url', match[0]);

      - uses: let-sunny/canicode-action@v0.1.0
        if: steps.figma.outputs.skip != 'true'
        with:
          figma_url: ${{ steps.figma.outputs.url }}
          figma_token: ${{ secrets.FIGMA_TOKEN }}
          min_score: 70
```

Add a PR template to your repo so contributors include the Figma URL:

```markdown
<!-- .github/pull_request_template.md -->

## Figma
<!-- Paste Figma URL with node-id for design quality check -->

```

If the PR body contains a Figma URL, the action runs analysis and posts results. No URL = skipped.

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `figma_url` | Yes | — | Figma URL with `node-id` |
| `figma_token` | Yes | — | Figma API token |
| `min_score` | No | `60` | Minimum score to pass (0-100) |
| `preset` | No | `dev-friendly` | `relaxed` \| `dev-friendly` \| `ai-ready` \| `strict` |
| `comment` | No | `true` | Post results as PR comment |
| `version` | No | `latest` | canicode CLI version |
| `fail_on_error` | No | `true` | Fail if analysis errors |

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

## Roadmap: Design-to-Code Pipeline

Beyond quality gating, we're building a pipeline that automatically generates code from Figma designs using AI.

**The vision:** A designer pastes a Figma URL, and the action analyzes the design, generates code with AI, and creates a PR with a side-by-side screenshot comparison — no developer handoff needed.

```
Figma Design → canicode analysis → AI code generation → screenshot comparison → PR
```

The prototype action is available at [`actions/design-to-code`](./actions/design-to-code). You can see a working example here:

> [**feat: design to code (82% B)** — #5](https://github.com/let-sunny/canicode-action/pull/5)

The AI-generated code isn't pixel-perfect yet, but we're improving accuracy by combining raw Figma node data with screenshot references.

## License

MIT
