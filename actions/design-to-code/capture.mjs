import { chromium } from "playwright";
import { existsSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { appendFileSync } from "fs";

const outputDir = process.env.OUTPUT_DIR;

// Find the main HTML file to screenshot
function findHtmlFile(dir) {
  const candidates = ["index.html", "preview.html", "main.html"];
  for (const name of candidates) {
    const path = join(dir, name);
    if (existsSync(path)) return path;
  }
  // Fall back to first .html file
  const files = readdirSync(dir).filter((f) => f.endsWith(".html"));
  return files.length > 0 ? join(dir, files[0]) : null;
}

const htmlFile = findHtmlFile(outputDir);

if (!htmlFile) {
  console.log("No HTML file found in output — skipping screenshot");
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    appendFileSync(outputPath, "has_capture=false\n");
  }
  process.exit(0);
}

console.log(`Capturing screenshot of: ${htmlFile}`);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
});

await page.goto(`file://${resolve(htmlFile)}`, {
  waitUntil: "networkidle",
  timeout: 30000,
});

// Wait a bit for any CSS animations/transitions
await page.waitForTimeout(1000);

await page.screenshot({
  path: "/tmp/implementation-screenshot.png",
  fullPage: true,
});

await browser.close();

console.log("Screenshot saved: /tmp/implementation-screenshot.png");

const outputPath = process.env.GITHUB_OUTPUT;
if (outputPath) {
  appendFileSync(outputPath, "has_capture=true\n");
}
