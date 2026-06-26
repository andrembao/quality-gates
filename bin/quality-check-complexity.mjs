#!/usr/bin/env node
import path from "node:path";
import { getConfigPathFromArgs } from "../src/args.mjs";
import { loadQualityConfig } from "../src/config-loader.mjs";
import { runComplexityCheck } from "../src/check-complexity.mjs";

const configPath = getConfigPathFromArgs(process.argv);
const config = await loadQualityConfig(configPath);
const reportDir = path.resolve(process.cwd(), config.reportDir ?? "report");

const result = await runComplexityCheck({
  reportDir,
  command: config.paths?.lintCommand,
  thresholds: config.thresholds,
});

if (!result.passed) {
  process.exit(result.exitCode || 1);
}
