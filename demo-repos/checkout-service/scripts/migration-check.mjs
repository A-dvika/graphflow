import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const migrations = (await readdir("migrations")).filter((file) => file.endsWith(".sql"));

for (const migration of migrations) {
  const sql = await readFile(join("migrations", migration), "utf8");

  if (/drop\s+table/i.test(sql) && !/graphflow-approved-destructive-change/i.test(sql)) {
    console.error(`Migration ${migration} contains a destructive statement without approval marker.`);
    process.exit(1);
  }
}

console.log(`${migrations.length} migration file(s) reviewed.`);
