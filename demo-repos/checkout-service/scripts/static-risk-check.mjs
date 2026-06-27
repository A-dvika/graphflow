import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

if (process.env.DEMO_SECURITY_FAILURE === "true") {
  console.error("Demo security failure enabled. Static risk scan fails intentionally.");
  process.exit(1);
}

const riskyPatterns = [/eval\s*\(/, /new Function\s*\(/, /process\.env\.[A-Z_]*SECRET/];
const files = (await readdir("src")).filter((file) => file.endsWith(".js"));

for (const file of files) {
  const content = await readFile(join("src", file), "utf8");
  const matched = riskyPatterns.find((pattern) => pattern.test(content));

  if (matched) {
    console.error(`Static risk pattern ${matched} found in ${file}.`);
    process.exit(1);
  }
}

console.log("Static risk check passed.");
