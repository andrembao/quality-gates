import fs from "node:fs/promises";
import path from "node:path";
import { runCommand } from "./process.mjs";
import { parsePlaywrightExecution, parseVitestExecution } from "./test-parsers.mjs";
import { generateQualityReport } from "./report-generator.mjs";

export async function runQualityPipeline(config) {
  const reportDir = path.resolve(process.cwd(), config.reportDir ?? "report");
  await fs.mkdir(reportDir, { recursive: true });

  const startedAt = new Date().toISOString();
  const results = [];
  const testExecutionSummary = {
    generatedAt: new Date().toISOString(),
    unit: null,
    e2e: null
  };

  for (const check of config.checks ?? []) {
    console.log(`\n=== Running: ${check.label} ===`);
    const { code, output } = await runCommand(check.command);
    const passed = code === 0;

    results.push({
      ...check,
      passed,
      exitCode: code
    });

    if (check.id === "unitCoverage") {
      testExecutionSummary.unit = parseVitestExecution(output, code);
    }

    if (check.id === "e2eCoverage") {
      testExecutionSummary.e2e = parsePlaywrightExecution(output, code);
    }
  }

  const runSummary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    checks: results,
    blockingFailures: results.filter((entry) => entry.blocking && !entry.passed).map((entry) => entry.id)
  };

  await fs.writeFile(path.join(reportDir, "quality-run.json"), `${JSON.stringify(runSummary, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(reportDir, "test-execution-summary.json"), `${JSON.stringify(testExecutionSummary, null, 2)}\n`, "utf8");

  await generateQualityReport(config);

  return {
    passed: runSummary.blockingFailures.length === 0,
    blockingFailures: runSummary.blockingFailures
  };
}
