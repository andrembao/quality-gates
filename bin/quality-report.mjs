#!/usr/bin/env node
import { getConfigPathFromArgs } from "../src/args.mjs";
import { loadQualityConfig } from "../src/config-loader.mjs";
import { generateQualityReport } from "../src/report-generator.mjs";

const configPath = getConfigPathFromArgs(process.argv);
const config = await loadQualityConfig(configPath);
await generateQualityReport(config);
console.log(`Quality report generated at ${config.reportDir}/${config.reportFile}`);
