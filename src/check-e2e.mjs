import fs from "node:fs/promises";
import path from "node:path";
import istanbulCoverage from "istanbul-lib-coverage";

const { createCoverageMap, createCoverageSummary } = istanbulCoverage;

function normalizeAbsolutePath(filePath) {
  return path.resolve(filePath);
}

function toPlainMetric(metric) {
  const pct = typeof metric.pct === "number" ? metric.pct : Number(metric.pct);

  return {
    total: metric.total,
    covered: metric.covered,
    skipped: metric.skipped,
    pct: Number(pct.toFixed(2))
  };
}

function toPlainSummary(summary) {
  return {
    lines: toPlainMetric(summary.lines),
    statements: toPlainMetric(summary.statements),
    functions: toPlainMetric(summary.functions),
    branches: toPlainMetric(summary.branches)
  };
}

function emptyMetric() {
  return {
    total: 0,
    covered: 0,
    skipped: 0,
    pct: null
  };
}

function emptySummary() {
  return {
    lines: emptyMetric(),
    statements: emptyMetric(),
    functions: emptyMetric(),
    branches: emptyMetric()
  };
}

async function writeFailureSummary({ reportDir, summaryFilePath, threshold, targetFiles, reason }) {
  const report = {
    threshold,
    error: reason,
    coverageFilesCollected: 0,
    instrumentedFilesCollected: 0,
    targetFilesCount: targetFiles.length,
    instrumentedTargetFiles: 0,
    measuredTargetFiles: 0,
    missingTargetFiles: [...targetFiles],
    total: emptySummary(),
    files: targetFiles.map((file) => ({
      file,
      instrumented: false,
      summary: emptySummary()
    }))
  };

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(summaryFilePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

export async function runE2ECoverageCheck({ reportDir, browserCoverageDir, targetFiles, threshold, requireAllTargets }) {
  const summaryFilePath = path.join(reportDir, "coverage-summary.json");

  try {
    const coverageMap = createCoverageMap({});
    let files;

    try {
      files = await fs.readdir(browserCoverageDir);
    } catch {
      throw new Error("No e2e coverage files found in .coverage/e2e/browser");
    }

    const coverageFiles = files.filter((file) => file.endsWith(".json"));

    if (coverageFiles.length === 0) {
      throw new Error("No e2e coverage files found in .coverage/e2e/browser");
    }

    for (const file of coverageFiles) {
      const rawContent = await fs.readFile(path.join(browserCoverageDir, file), "utf8");
      coverageMap.merge(JSON.parse(rawContent));
    }

    const measuredCoverageFiles = new Set(coverageMap.files().map((filePath) => normalizeAbsolutePath(filePath)));
    const totalSummary = createCoverageSummary();
    const fileSummaries = [];
    let instrumentedTargetFiles = 0;
    let measuredTargetFiles = 0;
    let aggregateTotals = {
      lines: 0,
      statements: 0,
      functions: 0
    };

    if (targetFiles.length === 0) {
      // No target files specified: aggregate all instrumented files
      for (const filePath of coverageMap.files()) {
        const summary = coverageMap.fileCoverageFor(filePath).toSummary();
        const plainSummary = toPlainSummary(summary);
        aggregateTotals = {
          lines: aggregateTotals.lines + plainSummary.lines.total,
          statements: aggregateTotals.statements + plainSummary.statements.total,
          functions: aggregateTotals.functions + plainSummary.functions.total
        };
        totalSummary.merge(summary);
        instrumentedTargetFiles += 1;
        measuredTargetFiles += 1;
      }
    } else {
      for (const relativeFile of targetFiles) {
        const absoluteFile = normalizeAbsolutePath(path.join(process.cwd(), relativeFile));
        const isInstrumented = measuredCoverageFiles.has(absoluteFile);
        const summary = isInstrumented
          ? coverageMap.fileCoverageFor(absoluteFile).toSummary()
          : createCoverageSummary();

        const plainSummary = toPlainSummary(summary);

        if (isInstrumented) {
          instrumentedTargetFiles += 1;
        }

        if (
          plainSummary.lines.total > 0 ||
          plainSummary.statements.total > 0 ||
          plainSummary.functions.total > 0 ||
          plainSummary.branches.total > 0
        ) {
          measuredTargetFiles += 1;
        }

        aggregateTotals = {
          lines: aggregateTotals.lines + plainSummary.lines.total,
          statements: aggregateTotals.statements + plainSummary.statements.total,
          functions: aggregateTotals.functions + plainSummary.functions.total
        };

        totalSummary.merge(summary);
        fileSummaries.push({
          file: relativeFile,
          instrumented: isInstrumented,
          summary: plainSummary
        });
      }
    }

    const plainTotal = toPlainSummary(totalSummary);
    const missingTargetFiles = targetFiles.filter((relativeFile) => {
      const absoluteFile = normalizeAbsolutePath(path.join(process.cwd(), relativeFile));
      return !measuredCoverageFiles.has(absoluteFile);
    });
    const report = {
      threshold,
      coverageFilesCollected: coverageFiles.length,
      instrumentedFilesCollected: measuredCoverageFiles.size,
      targetFilesCount: targetFiles.length,
      instrumentedTargetFiles,
      measuredTargetFiles,
      missingTargetFiles,
      total: plainTotal,
      files: fileSummaries
    };

    await fs.mkdir(reportDir, { recursive: true });
    await fs.writeFile(summaryFilePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const hasMeasuredTotals = aggregateTotals.lines > 0 && aggregateTotals.statements > 0 && aggregateTotals.functions > 0;
    if (!hasMeasuredTotals) {
      throw new Error("Invalid e2e coverage: no monitored target produced instrumented lines/statements/functions.");
    }

    const failedMetrics = ["statements", "functions", "lines"].filter((metric) => plainTotal[metric].pct < threshold);

    if (failedMetrics.length > 0) {
      throw new Error(`E2e coverage below threshold in: ${failedMetrics.join(", ")} (minimum ${threshold}%)`);
    }

    if (requireAllTargets && missingTargetFiles.length > 0) {
      throw new Error(`Incomplete e2e coverage: uninstrumented targets (${missingTargetFiles.join(", ")})`);
    }

    if (requireAllTargets && measuredTargetFiles < targetFiles.length) {
      throw new Error(
        `Incomplete e2e coverage: only ${measuredTargetFiles}/${targetFiles.length} monitored targets produced metrics.`
      );
    }

    return {
      passed: true,
      exitCode: 0
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown failure while validating e2e coverage.";

    try {
      await fs.access(summaryFilePath);
    } catch {
      await writeFailureSummary({ reportDir, summaryFilePath, threshold, targetFiles, reason });
    }

    console.error(reason);

    return {
      passed: false,
      exitCode: 1
    };
  }
}
