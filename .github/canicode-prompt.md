# Design to Code Instructions

## Stack
- HTML + CSS (single file)
- No frameworks, no build step

## Conventions
- Semantic HTML elements
- CSS variables for colors
- Flexbox / Grid for layout
- Mobile-friendly viewport

## CRITICAL: Pixel-Perfect Accuracy
Your goal is to produce output that is visually IDENTICAL to the Figma design.

- Extract exact hex color values from the Figma data — do NOT approximate
- Use exact font-family, font-size, font-weight, line-height, letter-spacing from the data
- Match padding, margin, gap values to the exact pixel
- Replicate border-radius, box-shadow, opacity exactly as specified
- Preserve the auto-layout direction (flex-direction) and alignment
- If the screenshot and data conflict, trust the data values
- Compare your output mentally against the screenshot — every detail matters

## Output
- Single `index.html` file with inline `<style>`
- Must render correctly when opened as a local file
- Result should be visually indistinguishable from the Figma screenshot when placed side by side
