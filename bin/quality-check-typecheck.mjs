#!/usr/bin/env node
import path from "node:path";
import { getConfigPathFromArgs } from "../src/args.mjs";
import { loadQualityConfig } from "../src/config-loader.mjs";
import { runTypecheck } from "../src/check-typecheck.mjs";

const configPath = getConfigPathFromArgs(process.argv);
const config = await loadQualityConfig(configPath);
const reportDir = path.resolve(process.cwd(), config.reportDir ?? "report");

const result = await runTypecheck({
  reportDir,
  command: config.paths?.typecheckCommand
});

if (!result.passed) {
  process.exit(result.exitCode || 1);
}
