import { mkdir, writeFile } from "node:fs/promises";
import { createCheckoutResponse } from "../src/server.js";

const sample = createCheckoutResponse({
  checkoutId: "build_sample",
  region: "US",
  items: [{ sku: "build-verification", unitPriceCents: 1000, quantity: 1 }],
});

await mkdir("dist", { recursive: true });
await writeFile("dist/build-manifest.json", `${JSON.stringify({ ok: true, sample }, null, 2)}\n`);

console.log("Build manifest generated.");
