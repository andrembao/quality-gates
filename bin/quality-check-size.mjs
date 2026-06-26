#!/usr/bin/env node
import path from "node:path";
import { getConfigPathFromArgs } from "../src/args.mjs";
import { loadQualityConfig } from "../src/config-loader.mjs";
import { runSizeCheck } from "../src/check-size.mjs";

const configPath = getConfigPathFromArgs(process.argv);
const config = await loadQualityConfig(configPath);
const reportDir = path.resolve(process.cwd(), config.reportDir ?? "report");

const result = await runSizeCheck({
  rootDir: config.size?.rootDir ?? "app",
  reportDir,
  thresholds: {
    tsxFileLines: config.thresholds?.tsxFileLinesWarning,
    functionLines: config.thresholds?.functionLinesWarning
  },
  allowed: config.size?.allowed ?? {},
  extensions: config.size?.extensions ?? [".tsx"]
});

if (!result.passed) {
  console.error("Size metric failed: new violations found beyond baseline.");
  process.exit(1);
}
