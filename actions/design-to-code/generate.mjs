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
const figmaNodesPath = process.env.FIGMA_NODES_PATH || "/tmp/canicode-fixture.json";
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

// Screenshot if available
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
  const data = JSON.parse(figmaNodes);
  const bbox = data.document?.absoluteBoundingBox
    ?? Object.values(data.nodes ?? {})[0]?.document?.absoluteBoundingBox;
  if (bbox) {
    designWidth = Math.round(bbox.width);
    designHeight = Math.round(bbox.height);
  }
} catch { /* ignore */ }

console.log(`  Design size: ${designWidth}x${designHeight}`);

// Text content
parts.push({
  type: "text",
  text: [
    "# Instructions",
    promptContent,
    "",
    `# Design Dimensions: ${designWidth}px x ${designHeight}px`,
    `The root element must be exactly ${designWidth}px wide and ${designHeight}px tall.`,
    "These values come from the Figma data. Do not change them.",
    "",
    "# Figma Design Data",
    "This is the exact Figma node tree. Every value here is intentional.",
    "Reproduce each value exactly: colors, fonts, spacing, sizes, layout.",
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
    "```json",
    analysisContent,
    "```",
    "",
    "# Task",
    "Reproduce this Figma design as HTML+CSS. Do not interpret or improve — just reproduce.",
    "The screenshot is your visual reference. The data is your source of truth.",
    "",
    "Output the code block first, then the interpretations list (see Instructions).",
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

// Parse interpretations
let interpretations = "none";
const interpMatch = text.match(/\/\/ interpretations:([\s\S]*?)(?:```|$)/);
if (interpMatch) {
  interpretations = interpMatch[1].trim();
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

// Write interpretations file
writeFileSync(join(outputDir, "interpretations.md"), interpretations + "\n", "utf-8");
console.log(`  Interpretations: ${interpretations === "none" ? "none" : interpretations.split("\n").length + " items"}`);

// Set outputs
const ghOutput = process.env.GITHUB_OUTPUT;
if (ghOutput) {
  appendFileSync(ghOutput, `files=${writtenFiles.join(",")}\n`);
  // Use heredoc for multiline interpretations
  appendFileSync(ghOutput, `interpretations<<ENDINTERP\n${interpretations}\nENDINTERP\n`);
}

console.log(`Generated ${writtenFiles.length} file(s)`);
