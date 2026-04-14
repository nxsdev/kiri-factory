import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const rawTag = process.argv[2];

if (!rawTag) {
  throw new Error("Usage: node ./scripts/extract-release-notes.mjs <tag>");
}

const version = rawTag.replace(/^refs\/tags\//, "").replace(/^v/, "");
const changelog = readFileSync(resolve("CHANGELOG.md"), "utf8");
const lines = changelog.split(/\r?\n/);
const heading = `## [${version}]`;

const startIndex = lines.findIndex((line) => line.trim() === heading);

if (startIndex === -1) {
  throw new Error(`Could not find ${heading} in CHANGELOG.md`);
}

let endIndex = lines.length;

for (let index = startIndex + 1; index < lines.length; index += 1) {
  if (/^## \[[^\]]+\]/.test(lines[index])) {
    endIndex = index;
    break;
  }
}

const sectionLines = lines.slice(startIndex + 1, endIndex);
let trimmedEnd = sectionLines.length;

while (trimmedEnd > 0 && sectionLines[trimmedEnd - 1].trim() === "") {
  trimmedEnd -= 1;
}

while (trimmedEnd > 0 && /^\[[^\]]+\]:\s+/.test(sectionLines[trimmedEnd - 1].trim())) {
  trimmedEnd -= 1;
}

while (trimmedEnd > 0 && sectionLines[trimmedEnd - 1].trim() === "") {
  trimmedEnd -= 1;
}

const notes = sectionLines.slice(0, trimmedEnd).join("\n").trim();

if (!notes) {
  throw new Error(`CHANGELOG.md section ${heading} is empty`);
}

process.stdout.write(`${notes}\n`);
