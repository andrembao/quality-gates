import fs from "node:fs/promises";
import path from "node:path";
import istanbulCoverage from "istanbul-lib-coverage";

const { createCoverageMap } = istanbulCoverage;

async function readJson(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  return `${value.toFixed(2)}%`;
}

function getStatusBadge(passed) {
  return passed ? '<span class="badge pass">PASS</span>' : '<span class="badge fail">FAIL</span>';
}

function computeUnitCoverageFromFinal(coverageFinal) {
  if (!coverageFinal || typeof coverageFinal !== "object") {
    return null;
  }

  const coverageMap = createCoverageMap({});
  coverageMap.merge(coverageFinal);
  const summary = coverageMap.getCoverageSummary();

  return {
    statements: Number(summary.statements.pct.toFixed(2)),
    functions: Number(summary.functions.pct.toFixed(2)),
    lines: Number(summary.lines.pct.toFixed(2)),
    files: coverageMap.files().length
  };
}

function formatCoverageBreakdown(summary) {
  if (!summary) {
    return "N/A";
  }

  return `Stmt ${formatPercent(summary.statements)} | Fn ${formatPercent(summary.functions)} | Lines ${formatPercent(summary.lines)}`;
}

function summarizeLint(lintReport) {
  if (!Array.isArray(lintReport)) {
    return null;
  }

  return lintReport.reduce(
    (acc, file) => {
      acc.errors += file.errorCount ?? 0;
      acc.warnings += file.warningCount ?? 0;
      return acc;
    },
    { errors: 0, warnings: 0 }
  );
}

function summarizeComplexity(complexityReport) {
  if (!Array.isArray(complexityReport)) {
    return null;
  }

  let totalErrors = 0;
  let cyclomaticViolations = 0;
  let cognitiveViolations = 0;

  for (const file of complexityReport) {
    totalErrors += file.errorCount ?? 0;
    for (const message of file.messages ?? []) {
      if (message.ruleId === "complexity") {
        cyclomaticViolations += 1;
      }
      if (message.ruleId === "sonarjs/cognitive-complexity") {
        cognitiveViolations += 1;
      }
    }
  }

  return { totalErrors, cyclomaticViolations, cognitiveViolations };
}

function summarizeDuplication(jscpdReport) {
  const stats = jscpdReport?.statistics;
  if (!stats) {
    return null;
  }

  let duplicationPct = null;
  if (stats.total?.percentage) {
    duplicationPct = Number(stats.total.percentage);
  } else if (stats.formats) {
    const formats = Object.values(stats.formats);
    const lines = formats.reduce((sum, format) => sum + (format?.lines ?? 0), 0);
    const duplicated = formats.reduce((sum, format) => sum + (format?.duplicatedLines ?? 0), 0);
    if (lines > 0) {
      duplicationPct = (duplicated / lines) * 100;
    }
  }

  return {
    clones: jscpdReport?.duplicates?.length ?? null,
    percentage: duplicationPct !== null ? Number(duplicationPct.toFixed(2)) : null
  };
}

function summarizeMutation(mutationReport) {
  if (!mutationReport) {
    return null;
  }

  const files = mutationReport.files ? Object.values(mutationReport.files) : [];
  let total = 0;
  let killed = 0;

  for (const file of files) {
    for (const mutant of file.mutants ?? []) {
      total += 1;
      if (mutant.status === "Killed" || mutant.status === "Timeout" || mutant.status === "RuntimeError") {
        killed += 1;
      }
    }
  }

  const score = total > 0 ? (killed / total) * 100 : null;

  return {
    totalMutants: total,
    killedMutants: killed,
    score: typeof score === "number" ? Number(score.toFixed(2)) : null
  };
}

function getNewSizeViolationsCount(sizeSummary) {
  if (!sizeSummary?.newViolations) {
    return null;
  }

  return (sizeSummary.newViolations.largeFiles?.length ?? 0) + (sizeSummary.newViolations.largeFunctions?.length ?? 0);
}

function getCurrentSizeWarningsCount(sizeSummary) {
  if (!sizeSummary?.summary) {
    return null;
  }

  return (sizeSummary.summary.largeFileWarnings ?? 0) + (sizeSummary.summary.largeFunctionWarnings ?? 0);
}

export async function generateQualityReport(config) {
  const root = process.cwd();
  const reportDir = path.resolve(root, config.reportDir ?? "report");
  const reportFile = config.reportFile ?? "quality-report.html";
  const thresholds = config.thresholds ?? {};

  const qualityRun = await readJson(path.join(reportDir, "quality-run.json"));
  const lintReport = await readJson(path.join(reportDir, "lint.json"));
  const typecheckReport = await readJson(path.join(reportDir, "typecheck.json"));
  const complexityReport = await readJson(path.join(reportDir, "complexity.json"));
  const sizeWarningsReport = await readJson(path.join(reportDir, "size-warnings.json"));
  const e2eReport = await readJson(path.join(root, ".coverage", "e2e", "coverage-summary.json"));
  const jscpdReport = await readJson(path.join(reportDir, "jscpd-report.json"));
  const mutationReport = await readJson(path.join(reportDir, "mutation", "mutation-report.json"));
  const unitCoverageFinal = await readJson(path.join(root, "coverage", "coverage-final.json"));
  const testExecutionSummary = await readJson(path.join(reportDir, "test-execution-summary.json"));

  const lintSummary = summarizeLint(lintReport);
  const complexitySummary = summarizeComplexity(complexityReport);
  const unitSummary = computeUnitCoverageFromFinal(unitCoverageFinal);
  const duplicationSummary = summarizeDuplication(jscpdReport);
  const mutationSummary = summarizeMutation(mutationReport);
  const sizeSummary = sizeWarningsReport;

  const lintPass = lintSummary
    ? lintSummary.warnings <= Number(thresholds.lintWarnings ?? 0) && lintSummary.errors <= Number(thresholds.lintErrors ?? 0)
    : false;
  const typecheckPass = typecheckReport
    ? typecheckReport.errorCount <= Number(thresholds.typecheckErrors ?? 0) && Boolean(typecheckReport.passed)
    : false;
  const complexityPass = complexitySummary ? complexitySummary.totalErrors === 0 : false;
  const unitPass = unitSummary
    ? unitSummary.statements >= Number(thresholds.unitCoverage ?? 70) &&
      unitSummary.functions >= Number(thresholds.unitCoverage ?? 70) &&
      unitSummary.lines >= Number(thresholds.unitCoverage ?? 70)
    : false;
  const e2ePass = e2eReport
    ? e2eReport.total.statements.pct >= Number(thresholds.e2eCoverage ?? 50) &&
      e2eReport.total.functions.pct >= Number(thresholds.e2eCoverage ?? 50) &&
      e2eReport.total.lines.pct >= Number(thresholds.e2eCoverage ?? 50)
    : false;
  const duplicationPass = duplicationSummary?.percentage !== null
    ? duplicationSummary.percentage <= Number(thresholds.duplication ?? 5)
    : false;
  const mutationPass = mutationSummary?.score !== null
    ? mutationSummary.score >= Number(thresholds.mutation ?? 60)
    : false;
  const sizePass = sizeSummary ? Boolean(sizeSummary.passed) : false;
  const e2eTargetsPass = e2eReport
    ? e2eReport.instrumentedTargetFiles === e2eReport.targetFilesCount &&
      e2eReport.measuredTargetFiles === e2eReport.targetFilesCount
    : false;

  const globalPass = [
    lintPass,
    typecheckPass,
    complexityPass,
    sizePass,
    unitPass,
    e2ePass,
    e2eTargetsPass,
    duplicationPass,
    mutationPass
  ].every(Boolean);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Quality Report</title>
  <style>
    :root {
      --bg: #f7f8fb;
      --card: #ffffff;
      --text: #1b1d23;
      --muted: #5d6472;
      --ok: #16794d;
      --ok-bg: #e9f8f0;
      --fail: #a12622;
      --fail-bg: #fdeeee;
      --warn: #8f5d00;
      --warn-bg: #fff4de;
      --border: #d8dce6;
    }
    body {
      font-family: "Segoe UI", Tahoma, sans-serif;
      margin: 0;
      background: linear-gradient(180deg, #f7f8fb 0%, #eef2f8 100%);
      color: var(--text);
    }
    .container {
      max-width: 1080px;
      margin: 0 auto;
      padding: 28px;
    }
    .headline {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }
    h1 { margin: 0; }
    .meta { color: var(--muted); font-size: 14px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 14px;
      margin-bottom: 20px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px;
    }
    .card h3 {
      margin: 0 0 8px;
      font-size: 16px;
    }
    .metric {
      font-size: 26px;
      font-weight: 700;
      margin: 6px 0;
    }
    .badge {
      display: inline-block;
      font-size: 12px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid transparent;
    }
    .pass { color: var(--ok); background: var(--ok-bg); border-color: #b7e4cd; }
    .fail { color: var(--fail); background: var(--fail-bg); border-color: #f0b8b5; }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    th, td {
      padding: 10px;
      border-bottom: 1px solid var(--border);
      text-align: left;
      font-size: 14px;
    }
    th { background: #f2f5fb; }
    .section-title {
      margin: 24px 0 10px;
      font-size: 18px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="headline">
      <div>
        <h1>Quality Report</h1>
        <div class="meta">Generated at: ${new Date().toISOString()}</div>
      </div>
      <div>${getStatusBadge(globalPass)}</div>
    </div>

    <div class="grid">
      <div class="card">
        <h3>Lint</h3>
        <div class="metric">${lintSummary ? `${lintSummary.errors}E / ${lintSummary.warnings}W` : "N/A"}</div>
        <div>Errors + warnings (limits: ${Number(thresholds.lintErrors ?? 0)} / ${Number(thresholds.lintWarnings ?? 0)}) ${getStatusBadge(lintPass)}</div>
      </div>
      <div class="card">
        <h3>Typecheck</h3>
        <div class="metric">${typecheckReport ? typecheckReport.errorCount : "N/A"}</div>
        <div>Errors (limit: ${Number(thresholds.typecheckErrors ?? 0)}) ${getStatusBadge(typecheckPass)}</div>
      </div>
      <div class="card">
        <h3>Complexity</h3>
        <div class="metric">${complexitySummary ? complexitySummary.totalErrors : "N/A"}</div>
        <div>Violations ${getStatusBadge(complexityPass)}</div>
      </div>
      <div class="card">
        <h3>Unit Coverage</h3>
        <div class="metric">${unitSummary ? formatPercent(unitSummary.lines) : "N/A"}</div>
        <div>Stmt/Fn/Lines gate (limit: ${Number(thresholds.unitCoverage ?? 70)}%) ${getStatusBadge(unitPass)}</div>
        <div class="meta">${formatCoverageBreakdown(unitSummary)}${unitSummary?.files ? ` | Files: ${unitSummary.files}` : ""}</div>
      </div>
      <div class="card">
        <h3>E2E Coverage</h3>
        <div class="metric">${e2eReport ? formatPercent(e2eReport.total.lines.pct) : "N/A"}</div>
        <div>Stmt/Fn/Lines gate (limit: ${Number(thresholds.e2eCoverage ?? 50)}%) ${getStatusBadge(e2ePass)}</div>
        <div class="meta">${e2eReport ? `Stmt ${formatPercent(e2eReport.total.statements.pct)} | Fn ${formatPercent(e2eReport.total.functions.pct)} | Lines ${formatPercent(e2eReport.total.lines.pct)}` : "N/A"}</div>
        <div class="meta">${e2eReport ? `Measured targets: ${e2eReport.measuredTargetFiles}/${e2eReport.targetFilesCount} | Instrumented targets: ${e2eReport.instrumentedTargetFiles}/${e2eReport.targetFilesCount}` : "N/A"}</div>
      </div>
      <div class="card">
        <h3>E2E Targets</h3>
        <div class="metric">${e2eReport ? `${e2eReport.measuredTargetFiles}/${e2eReport.targetFilesCount}` : "N/A"}</div>
        <div>Instrumented and measured targets ${getStatusBadge(e2eTargetsPass)}</div>
      </div>
      <div class="card">
        <h3>Duplication</h3>
        <div class="metric">${duplicationSummary?.percentage !== null ? formatPercent(duplicationSummary.percentage) : "N/A"}</div>
        <div>Lines (limit: ${Number(thresholds.duplication ?? 5)}%) ${getStatusBadge(duplicationPass)}</div>
      </div>
      <div class="card">
        <h3>Mutation</h3>
        <div class="metric">${mutationSummary?.score !== null ? formatPercent(mutationSummary.score) : "N/A"}</div>
        <div>Score (limit: ${Number(thresholds.mutation ?? 60)}%) ${getStatusBadge(mutationPass)}</div>
        <div class="meta">Killed: ${mutationSummary?.killedMutants ?? "N/A"} / ${mutationSummary?.totalMutants ?? "N/A"}</div>
      </div>
      <div class="card">
        <h3>Size Constraints</h3>
        <div class="metric">${getNewSizeViolationsCount(sizeSummary) ?? "N/A"}</div>
        <div>New violations (limit: 0 over baseline) ${getStatusBadge(sizePass)}</div>
        <div class="meta">Current oversized items: ${getCurrentSizeWarningsCount(sizeSummary) ?? "N/A"} | TSX > ${Number(thresholds.tsxFileLinesWarning ?? 350)}, Functions > ${Number(thresholds.functionLinesWarning ?? 70)}</div>
      </div>
    </div>

    <h2 class="section-title">Pipeline Execution</h2>
    <table>
      <thead>
        <tr><th>Check</th><th>Blocking</th><th>Status</th><th>Exit Code</th></tr>
      </thead>
      <tbody>
        ${(qualityRun?.checks ?? []).map((check) => `<tr><td>${check.label}</td><td>${check.blocking ? "Yes" : "No"}</td><td>${check.passed ? "PASS" : "FAIL"}</td><td>${check.exitCode}</td></tr>`).join("")}
      </tbody>
    </table>

    <h2 class="section-title">Last Test Executions</h2>
    <table>
      <thead>
        <tr><th>Scope</th><th>Total</th><th>Passed</th><th>Failed</th><th>Skipped</th><th>Duration</th><th>Exit Code</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>Unit (Vitest)</td>
          <td>${testExecutionSummary?.unit?.tests?.total ?? "N/A"}</td>
          <td>${testExecutionSummary?.unit?.tests?.passed ?? "N/A"}</td>
          <td>${testExecutionSummary?.unit?.tests?.failed ?? "N/A"}</td>
          <td>${testExecutionSummary?.unit?.tests?.skipped ?? "N/A"}</td>
          <td>${testExecutionSummary?.unit?.duration ?? "N/A"}</td>
          <td>${testExecutionSummary?.unit?.exitCode ?? "N/A"}</td>
        </tr>
        <tr>
          <td>E2E (Playwright)</td>
          <td>${testExecutionSummary?.e2e?.tests?.total ?? "N/A"}</td>
          <td>${testExecutionSummary?.e2e?.tests?.passed ?? "N/A"}</td>
          <td>${testExecutionSummary?.e2e?.tests?.failed ?? "N/A"}</td>
          <td>${testExecutionSummary?.e2e?.tests?.skipped ?? "N/A"}</td>
          <td>${testExecutionSummary?.e2e?.duration ?? "N/A"}</td>
          <td>${testExecutionSummary?.e2e?.exitCode ?? "N/A"}</td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(path.join(reportDir, reportFile), html, "utf8");
}
