import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = resolve(rootDir, "packages/rqb-v2/dist");
const targetDir = resolve(rootDir, "dist/rqb-v2");

if (!existsSync(sourceDir)) {
  throw new Error(`Missing rqb-v2 build output at ${sourceDir}`);
}

mkdirSync(resolve(rootDir, "dist"), { recursive: true });
rmSync(targetDir, { recursive: true, force: true });
cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Synced ${sourceDir} -> ${targetDir}`);
