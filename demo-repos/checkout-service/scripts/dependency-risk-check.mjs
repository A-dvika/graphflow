import { readFile } from "node:fs/promises";

const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const packages = Object.keys(lock.packages ?? {}).filter(Boolean);
const bannedPackages = ["event-stream", "flatmap-stream"];
const detected = packages.filter((name) => bannedPackages.some((banned) => name.includes(banned)));

if (detected.length > 0) {
  console.error(`Blocked dependency detected: ${detected.join(", ")}`);
  process.exit(1);
}

console.log("Dependency risk check passed.");
