#!/usr/bin/env node
import path from "node:path";
import { getConfigPathFromArgs } from "../src/args.mjs";
import { loadQualityConfig } from "../src/config-loader.mjs";
import { runE2ECoverageCheck } from "../src/check-e2e.mjs";

const configPath = getConfigPathFromArgs(process.argv);
const config = await loadQualityConfig(configPath);

const reportDir = path.resolve(process.cwd(), config.e2e?.reportDir ?? ".coverage/e2e");
const browserCoverageDir = path.resolve(process.cwd(), config.e2e?.browserCoverageDir ?? ".coverage/e2e/browser");

const result = await runE2ECoverageCheck({
  reportDir,
  browserCoverageDir,
  targetFiles: config.e2e?.targetFiles ?? [],
  threshold: Number(config.thresholds?.e2eCoverage ?? 50),
  requireAllTargets: config.e2e?.requireAllTargets !== false
});

if (!result.passed) {
  process.exit(result.exitCode || 1);
}
