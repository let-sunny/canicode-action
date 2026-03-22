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
const fixturePath = process.env.FIXTURE_PATH;
const analysisPath = process.env.ANALYSIS_PATH;
const hasScreenshot = process.env.HAS_SCREENSHOT === "true";

// Read files
const promptContent = readFileSync(promptFile, "utf-8");
const fixtureContent = readFileSync(fixturePath, "utf-8");
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

// Text content
parts.push({
  type: "text",
  text: [
    "# Instructions",
    promptContent,
    "",
    "# Figma Design Data (node tree)",
    "```json",
    fixtureContent.length > 100_000
      ? fixtureContent.slice(0, 100_000) + "\n... (truncated)"
      : fixtureContent,
    "```",
    "",
    "# Design Analysis (canicode)",
    "```json",
    analysisContent,
    "```",
    "",
    "# Task",
    "Generate the code based on the Figma design above.",
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
