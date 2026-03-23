/**
 * Extract a design tree from Figma fixture JSON.
 * Outputs a DOM-like tree with inline styles — AI reads this 1:1 to generate HTML+CSS.
 */

import { readFileSync, writeFileSync } from "fs";

const fixturePath = process.argv[2] || process.env.FIXTURE_PATH || "/tmp/canicode-fixture.json";
const outputPath = process.argv[3] || "/tmp/design-summary.txt";

const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));
const root = fixture.document;

function rgbaToHex(color) {
  if (!color) return null;
  const r = Math.round((color.r ?? 0) * 255);
  const g = Math.round((color.g ?? 0) * 255);
  const b = Math.round((color.b ?? 0) * 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
}

function getFill(node) {
  if (!node.fills || !Array.isArray(node.fills)) return null;
  for (const fill of node.fills) {
    if (fill.type === "SOLID" && fill.color) return rgbaToHex(fill.color);
  }
  return null;
}

function getStroke(node) {
  if (!node.strokes || !Array.isArray(node.strokes)) return null;
  for (const stroke of node.strokes) {
    if (stroke.type === "SOLID" && stroke.color) return rgbaToHex(stroke.color);
  }
  return null;
}

function getShadow(node) {
  if (!node.effects || !Array.isArray(node.effects)) return null;
  for (const effect of node.effects) {
    if (effect.type === "DROP_SHADOW" && effect.visible !== false) {
      const c = effect.color ? rgbaToHex(effect.color) : "#000";
      const ox = effect.offset?.x ?? 0;
      const oy = effect.offset?.y ?? 0;
      return `${ox}px ${oy}px ${effect.radius ?? 0}px ${c}`;
    }
  }
  return null;
}

function renderNode(node, indent) {
  if (!node) return "";
  if (node.visible === false) return "";

  const prefix = "  ".repeat(indent);
  const lines = [];

  // Node header: name (TYPE, WxH)
  const bbox = node.absoluteBoundingBox;
  const w = bbox ? Math.round(bbox.width) : "?";
  const h = bbox ? Math.round(bbox.height) : "?";
  let header = `${node.name} (${node.type}, ${w}x${h})`;
  lines.push(`${prefix}${header}`);

  // Style properties
  const styles = [];

  // Layout
  if (node.layoutMode) {
    const dir = node.layoutMode === "VERTICAL" ? "column" : "row";
    styles.push(`display: flex; flex-direction: ${dir}`);
    if (node.itemSpacing != null) styles.push(`gap: ${node.itemSpacing}px`);
    if (node.primaryAxisAlignItems) styles.push(`justify-content: ${mapAlign(node.primaryAxisAlignItems)}`);
    if (node.counterAxisAlignItems) styles.push(`align-items: ${mapAlign(node.counterAxisAlignItems)}`);
  }

  // Padding
  const pt = node.paddingTop ?? 0;
  const pr = node.paddingRight ?? 0;
  const pb = node.paddingBottom ?? 0;
  const pl = node.paddingLeft ?? 0;
  if (pt || pr || pb || pl) {
    styles.push(`padding: ${pt}px ${pr}px ${pb}px ${pl}px`);
  }

  // Sizing
  if (node.layoutSizingHorizontal === "FILL") styles.push("width: 100%");
  if (node.layoutSizingVertical === "FILL") styles.push("height: 100%");

  // Fill — for TEXT nodes, fill is text color, not background
  const fill = getFill(node);
  if (fill && node.type !== "TEXT") styles.push(`background: ${fill}`);

  // Border
  const stroke = getStroke(node);
  if (stroke) styles.push(`border: 1px solid ${stroke}`);

  // Border radius
  if (node.cornerRadius) styles.push(`border-radius: ${node.cornerRadius}px`);

  // Shadow
  const shadow = getShadow(node);
  if (shadow) styles.push(`box-shadow: ${shadow}`);

  // Typography
  if (node.type === "TEXT" && node.style) {
    const s = node.style;
    if (s.fontFamily) styles.push(`font-family: "${s.fontFamily}"`);
    if (s.fontWeight) styles.push(`font-weight: ${s.fontWeight}`);
    if (s.fontSize) styles.push(`font-size: ${s.fontSize}px`);
    if (s.lineHeightPx) styles.push(`line-height: ${s.lineHeightPx}px`);
    if (s.letterSpacing) styles.push(`letter-spacing: ${s.letterSpacing}px`);

    const textColor = getFill(node);
    if (textColor) styles.push(`color: ${textColor}`);
  }

  // Text content
  if (node.type === "TEXT" && node.characters) {
    styles.push(`text: "${node.characters}"`);
  }

  if (styles.length > 0) {
    lines.push(`${prefix}  style: ${styles.join("; ")}`);
  }

  // Children
  if (node.children) {
    for (const child of node.children) {
      const childOutput = renderNode(child, indent + 1);
      if (childOutput) lines.push(childOutput);
    }
  }

  return lines.join("\n");
}

function mapAlign(figmaAlign) {
  const map = {
    "MIN": "flex-start",
    "CENTER": "center",
    "MAX": "flex-end",
    "SPACE_BETWEEN": "space-between",
  };
  return map[figmaAlign] || figmaAlign;
}

// Render
const tree = renderNode(root, 0);

// Add header with global design info
const w = root.absoluteBoundingBox ? Math.round(root.absoluteBoundingBox.width) : 0;
const h = root.absoluteBoundingBox ? Math.round(root.absoluteBoundingBox.height) : 0;

const output = `# Design Tree
# Root: ${w}px x ${h}px
# Each node shows: name (TYPE, WxH) followed by CSS-like styles
# Reproduce this tree as HTML. Each node = one HTML element.
# Every style value is from Figma data — use exactly as shown.

${tree}
`;

writeFileSync(outputPath, output, "utf-8");

const sizeKB = Math.round(output.length / 1024);
console.log(`Design tree: ${sizeKB}KB`);
