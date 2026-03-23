import { generateText } from "ai";
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "fs";
import { join, dirname } from "path";

// Provider setup
async function getModel(provider) {
  switch (provider) {
    case "claude": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      return createAnthropic()("claude-sonnet-4-20250514");
    }
    case "openai": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      return createOpenAI()("gpt-4o");
    }
    case "gemini": {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      return createGoogleGenerativeAI()("gemini-2.0-flash");
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// Read inputs from env
const provider = process.env.LLM_PROVIDER || "claude";
const promptFile = process.env.PROMPT_FILE;
const outputDir = process.env.OUTPUT_DIR;
const figmaNodesPath = process.env.FIGMA_NODES_PATH;
const figmaStylesPath = process.env.FIGMA_STYLES_PATH;
const analysisPath = process.env.ANALYSIS_PATH;
const hasScreenshot = process.env.HAS_SCREENSHOT === "true";

// Read files
const promptContent = readFileSync(promptFile, "utf-8");
const figmaNodes = readFileSync(figmaNodesPath, "utf-8");
const figmaStyles = readFileSync(figmaStylesPath, "utf-8");
const analysisContent = readFileSync(analysisPath, "utf-8");

// Build message parts
const parts = [];

// Screenshot if available (high-res)
if (hasScreenshot) {
  const screenshot = readFileSync("/tmp/figma-screenshot.png");
  parts.push({
    type: "image",
    image: screenshot,
  });
}

// Extract root node dimensions from Figma data
let designWidth = 0;
let designHeight = 0;
try {
  const nodesData = JSON.parse(figmaNodes);
  const firstNode = Object.values(nodesData.nodes)[0];
  if (firstNode?.document?.absoluteBoundingBox) {
    designWidth = Math.round(firstNode.document.absoluteBoundingBox.width);
    designHeight = Math.round(firstNode.document.absoluteBoundingBox.height);
  }
} catch { /* ignore */ }

console.log(`  Design size: ${designWidth}x${designHeight}`);

// Text content — Figma raw data has full style info (colors, fonts, spacing, effects)
parts.push({
  type: "text",
  text: [
    "# Instructions",
    promptContent,
    "",
    `# Design Dimensions: ${designWidth}px x ${designHeight}px`,
    "CRITICAL: The output HTML must render at exactly this size.",
    `Set the root container to width: ${designWidth}px and min-height: ${designHeight}px.`,
    "Do NOT use 100vw or 100% width — use the exact pixel value.",
    "",
    "# Figma Design Data (full node tree with styles)",
    "This is the raw Figma API response. It contains exact colors (fills), fonts (style),",
    "spacing (paddingLeft/Right/Top/Bottom, itemSpacing), effects (shadows, blur),",
    "layout (layoutMode, constraints), and all visual properties.",
    "Use these exact values to produce pixel-accurate code.",
    "",
    "```json",
    figmaNodes.length > 200_000
      ? figmaNodes.slice(0, 200_000) + "\n... (truncated)"
      : figmaNodes,
    "```",
    "",
    "# Figma Styles (design tokens)",
    "```json",
    figmaStyles,
    "```",
    "",
    "# Design Analysis (canicode)",
    "Issues found in the design that may affect implementation:",
    "```json",
    analysisContent,
    "```",
    "",
    "# Task",
    "Generate code that reproduces this Figma design as accurately as possible.",
    "- Match exact colors, fonts, spacing, border-radius, and shadows from the Figma data",
    "- Use the screenshot as visual reference for layout and proportions",
    "- If the design has auto-layout, replicate it with flexbox/grid",
    "",
    "Output each file as a code block with the filename as a comment on the first line:",
    "```",
    "// filename: ComponentName.tsx",
    "... code here ...",
    "```",
    "",
    "Make sure the main component can render as a standalone HTML page for screenshot comparison.",
  ].join("\n"),
});

console.log(`Generating code with ${provider}...`);
console.log(`  Figma nodes: ${Math.round(figmaNodes.length / 1024)}KB`);
console.log(`  Figma styles: ${Math.round(figmaStyles.length / 1024)}KB`);
console.log(`  Screenshot: ${hasScreenshot ? "yes" : "no"}`);

const model = await getModel(provider);
const { text } = await generateText({
  model,
  messages: [{ role: "user", content: parts }],
  maxTokens: 16384,
});

// Parse code blocks from response
const codeBlockRegex = /```(?:\w+)?\n\/\/ filename: (.+)\n([\s\S]*?)```/g;
const files = [];
let match;

while ((match = codeBlockRegex.exec(text)) !== null) {
  const filename = match[1].trim();
  const code = match[2].trim();
  files.push({ filename, code });
}

// If no structured files found, save entire response as index.html
if (files.length === 0) {
  const anyBlock = text.match(/```(?:html|tsx|jsx|vue)?\n([\s\S]*?)```/);
  if (anyBlock) {
    files.push({ filename: "index.html", code: anyBlock[1].trim() });
  } else {
    files.push({ filename: "index.html", code: text });
  }
}

// Write files
mkdirSync(outputDir, { recursive: true });
const writtenFiles = [];

for (const { filename, code } of files) {
  const filePath = join(outputDir, filename);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, code + "\n", "utf-8");
  writtenFiles.push(filePath);
  console.log(`  Written: ${filePath}`);
}

// Set output
const ghOutput = process.env.GITHUB_OUTPUT;
if (ghOutput) {
  appendFileSync(ghOutput, `files=${writtenFiles.join(",")}\n`);
}

console.log(`Generated ${writtenFiles.length} file(s)`);
