#!/usr/bin/env node

import fs from "fs";

const args = process.argv.slice(2);
const options = {
  json: false,
  write: false,
  out: null,
};
const files = [];

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--json") {
    options.json = true;
    continue;
  }
  if (arg === "--write") {
    options.write = true;
    continue;
  }
  if (arg === "--out") {
    const outPath = args[i + 1];
    if (!outPath || outPath.startsWith("--")) {
      console.error("Missing value for --out");
      process.exit(1);
    }
    options.out = outPath;
    i += 1;
    continue;
  }
  if (arg.startsWith("--")) {
    console.error(`Unknown option: ${arg}`);
    process.exit(1);
  }
  files.push(arg);
}

if (files.length === 0) {
  console.error("Usage: node scripts/suggest_jsdoc.mjs <file...> [--json] [--write | --out <file>]");
  process.exit(1);
}

if (options.write && options.out) {
  console.error("Use either --write or --out, not both.");
  process.exit(1);
}

if ((options.write || options.out) && options.json) {
  console.error("--json cannot be combined with --write or --out.");
  process.exit(1);
}

if (options.out && files.length !== 1) {
  console.error("--out supports exactly one input file.");
  process.exit(1);
}

const FUNCTION_PATTERNS = [
  /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/,
  /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/,
  /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?([A-Za-z_$][\w$]*)\s*=>/,
  /^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/,
];

const RESERVED_METHOD_NAMES = new Set([
  "if",
  "for",
  "while",
  "switch",
  "catch",
]);

function hasJsDocAbove(lines, index) {
  let i = index - 1;
  while (i >= 0 && lines[i].trim() === "") i -= 1;
  if (i < 0) return false;

  if (lines[i].trim().endsWith("*/")) {
    while (i >= 0) {
      if (lines[i].includes("/**")) return true;
      if (lines[i].includes("/*") && !lines[i].includes("/**")) return false;
      i -= 1;
    }
  }

  return false;
}

function splitParams(rawParams) {
  if (!rawParams || rawParams.trim() === "") return [];
  return rawParams
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((param) => {
      let name = param.replace(/=[\s\S]*$/, "").trim();
      name = name.replace(/^\.\.\./, "");
      name = name.replace(/:[\s\S]*$/, "").trim();
      const optional = param.includes("=");
      return { name, optional };
    })
    .filter((p) => p.name.length > 0);
}

function inferParamType(name) {
  if (/^(is|has|should|can|enabled)/i.test(name)) return "boolean";
  if (/(count|size|total|index|offset|limit|age|id)$/i.test(name)) return "number";
  if (/(name|title|text|query|slug|path|url|email|token)$/i.test(name)) return "string";
  if (/^(items|list|arr|values|rows|records)/i.test(name)) return "Array<unknown>";
  if (/^(options|config|payload|data|params|meta)/i.test(name)) return "Object";
  return "unknown";
}

function inferReturnType(lines, startIndex) {
  const end = Math.min(lines.length, startIndex + 120);
  let sawReturnValue = false;
  let sawAsync = false;

  for (let i = startIndex; i < end; i += 1) {
    const line = lines[i];
    if (/\basync\b/.test(line)) sawAsync = true;
    if (/^\s*return\b(?!\s*;)/.test(line)) {
      sawReturnValue = true;
      break;
    }
  }

  if (!sawReturnValue) return null;
  return sawAsync ? "Promise<unknown>" : "unknown";
}

function makeJsDoc(name, params, returnType, indent = "") {
  const lines = [];
  lines.push(`${indent}/**`);
  lines.push(`${indent} * Describe ${name}.`);
  lines.push(`${indent} *`);
  for (const param of params) {
    const type = inferParamType(param.name);
    const paramName = param.optional ? `[${param.name}]` : param.name;
    lines.push(`${indent} * @param {${type}} ${paramName} Describe ${param.name}.`);
  }
  if (returnType) {
    lines.push(`${indent} * @returns {${returnType}} Describe returned value.`);
  }
  lines.push(`${indent} */`);
  return lines.join("\n");
}

function scanSource(filePath, source) {
  const lines = source.split(/\r?\n/);
  const findings = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const pattern of FUNCTION_PATTERNS) {
      const match = line.match(pattern);
      if (!match) continue;

      const [, name, rawParams = ""] = match;
      if (!name || RESERVED_METHOD_NAMES.has(name)) continue;
      if (name === "constructor") continue;
      if (hasJsDocAbove(lines, i)) continue;

      const indent = (line.match(/^\s*/) || [""])[0];
      const params = pattern === FUNCTION_PATTERNS[2]
        ? splitParams(rawParams)
        : splitParams(rawParams);
      const returnType = inferReturnType(lines, i);
      const jsdoc = makeJsDoc(name, params, returnType, indent);

      findings.push({
        file: filePath,
        line: i + 1,
        index: i,
        functionName: name,
        params: params.map((p) => p.name),
        returns: returnType,
        jsdoc,
      });

      break;
    }
  }

  return findings;
}

function applyJsDocToSource(source, findings) {
  if (findings.length === 0) return source;
  const lines = source.split(/\r?\n/);
  const byIndex = new Map();
  for (const finding of findings) {
    byIndex.set(finding.index, finding.jsdoc);
  }

  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const jsdoc = byIndex.get(i);
    if (jsdoc) {
      out.push(jsdoc);
    }
    out.push(lines[i]);
  }
  return out.join("\n");
}

const allFindings = [];
const perFile = [];
for (const file of files) {
  try {
    const source = fs.readFileSync(file, "utf8");
    const findings = scanSource(file, source);
    perFile.push({ file, source, findings });
    allFindings.push(...findings);
  } catch (error) {
    console.error(`Failed to read ${file}: ${error.message}`);
  }
}

if (options.write) {
  let changed = 0;
  for (const entry of perFile) {
    if (entry.findings.length === 0) continue;
    const updated = applyJsDocToSource(entry.source, entry.findings);
    fs.writeFileSync(entry.file, updated, "utf8");
    changed += 1;
    console.log(`Updated ${entry.file} (${entry.findings.length} block(s) inserted).`);
  }
  if (changed === 0) {
    console.log("No undocumented function candidates were found.");
  }
  process.exit(0);
}

if (options.out) {
  const entry = perFile[0];
  const updated = applyJsDocToSource(entry.source, entry.findings);
  fs.writeFileSync(options.out, updated, "utf8");
  console.log(`Wrote commented copy to ${options.out} (${entry.findings.length} block(s) inserted).`);
  process.exit(0);
}

if (options.json) {
  console.log(JSON.stringify(allFindings, null, 2));
  process.exit(0);
}

if (allFindings.length === 0) {
  console.log("No undocumented function candidates were found.");
  process.exit(0);
}

for (const finding of allFindings) {
  console.log(`${finding.file}:${finding.line} ${finding.functionName}`);
  console.log(finding.jsdoc);
  console.log("");
}
