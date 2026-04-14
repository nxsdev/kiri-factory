import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8"));

const requiredPaths = new Set(
  [
    packageJson.main,
    packageJson.module,
    packageJson.types,
    ...collectStringPaths(packageJson.exports),
  ]
    .filter(Boolean)
    .map(normalizePath),
);

const output = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
  cwd: rootDir,
  encoding: "utf8",
});

const packResult = JSON.parse(output);
const packedFiles = new Set((packResult[0]?.files ?? []).map((file) => normalizePath(file.path)));

const missingPaths = [...requiredPaths].filter((path) => !packedFiles.has(path));

if (missingPaths.length > 0) {
  throw new Error(`npm pack is missing exported files:\n- ${missingPaths.join("\n- ")}`);
}

console.log(`Verified npm tarball exports ${requiredPaths.size} file(s).`);

function collectStringPaths(value) {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStringPaths);
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStringPaths);
  }

  return [];
}

function normalizePath(path) {
  return path.replace(/^\.\/+/, "");
}
