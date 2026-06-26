import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function normalizeConfig(config, absolutePath) {
  if (!config || typeof config !== "object") {
    throw new Error(`Invalid quality config at ${absolutePath}`);
  }

  return {
    reportDir: config.reportDir ?? "report",
    reportFile: config.reportFile ?? "quality-report.html",
    checks: Array.isArray(config.checks) ? config.checks : [],
    thresholds: config.thresholds ?? {},
    size: config.size ?? {},
    e2e: config.e2e ?? {},
    paths: config.paths ?? {}
  };
}

async function loadTypeScriptConfig(absolutePath) {
  const source = await fs.readFile(absolutePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    fileName: absolutePath
  });

  const encoded = encodeURIComponent(transpiled.outputText);
  const moduleUrl = `data:text/javascript;charset=utf-8,${encoded}`;
  const imported = await import(moduleUrl);
  return imported.default;
}

export async function loadQualityConfig(configPath) {
  const absolutePath = path.resolve(configPath);
  const extension = path.extname(absolutePath).toLowerCase();

  let rawConfig;
  if (extension === ".json") {
    const source = await fs.readFile(absolutePath, "utf8");
    rawConfig = JSON.parse(source);
  } else if (extension === ".ts") {
    rawConfig = await loadTypeScriptConfig(absolutePath);
  } else {
    const imported = await import(pathToFileURL(absolutePath).href);
    rawConfig = imported.default;
  }

  return normalizeConfig(rawConfig, absolutePath);
}
