import { execSync } from "node:child_process";
import { loadTestEnv } from "./load-env";

export default function setup() {
  loadTestEnv();
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
}
