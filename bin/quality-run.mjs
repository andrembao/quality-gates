#!/usr/bin/env node
import { getConfigPathFromArgs } from "../src/args.mjs";
import { loadQualityConfig } from "../src/config-loader.mjs";
import { runQualityPipeline } from "../src/quality-runner.mjs";

const configPath = getConfigPathFromArgs(process.argv);
const config = await loadQualityConfig(configPath);
const result = await runQualityPipeline(config);

if (!result.passed) {
  process.exit(1);
}
