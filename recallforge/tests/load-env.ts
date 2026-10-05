import fs from "node:fs";
import path from "node:path";

export function loadTestEnv() {
  const file = path.resolve(__dirname, "../.env.test");
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (m) process.env[m[1]] = m[2];
  }
}
