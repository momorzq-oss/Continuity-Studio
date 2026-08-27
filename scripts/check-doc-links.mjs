#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

const root = process.cwd();
const ignored = new Set([".git", "node_modules", "data", "dist", "desktop-dist", "release", ".superdesign"]);
const markdownFiles = [];

function collect(directory) {
  for (const name of readdirSync(directory)) {
    if (ignored.has(name)) continue;
    const path = join(directory, name);
    if (statSync(path).isDirectory()) collect(path);
    else if (extname(name).toLowerCase() === ".md") markdownFiles.push(path);
  }
}

collect(root);
const failures = [];
const linkPattern = /!?(?:\[[^\]]*\])\(([^)]+)\)/g;

for (const file of markdownFiles) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(linkPattern)) {
    const raw = match[1].trim().replace(/^<|>$/g, "");
    if (!raw || raw.startsWith("#") || /^(?:https?:|mailto:|data:)/i.test(raw)) continue;
    const target = decodeURIComponent(raw.split("#", 1)[0].split("?", 1)[0]);
    if (!target) continue;
    const absolute = resolve(dirname(file), target);
    if (!existsSync(absolute)) failures.push(`${file.slice(root.length + 1)} -> ${raw}`);
  }
}

if (failures.length) {
  console.error(`Documentation link check failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Documentation link check passed: ${markdownFiles.length} Markdown files.`);
