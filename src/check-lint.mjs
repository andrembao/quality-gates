import fs from "node:fs/promises";
import path from "node:path";
import { runCommand } from "./process.mjs";

export async function runLintCheck({ reportDir, command, thresholds }) {
  await fs.mkdir(reportDir, { recursive: true });

  const lintCommand = command ?? "npx eslint .";
  const outputFile = path.join(reportDir, "lint.json");
  const jsonCommand = `${lintCommand} --format json --output-file ${outputFile}`;

  await runCommand(jsonCommand);

  let lintResults = [];
  try {
    lintResults = JSON.parse(await fs.readFile(outputFile, "utf8"));
  } catch {
    // ESLint may not write file on config errors — leave empty array
  }

  const totalErrors = lintResults.reduce((sum, f) => sum + (f.errorCount ?? 0), 0);
  const totalWarnings = lintResults.reduce((sum, f) => sum + (f.warningCount ?? 0), 0);

  const maxErrors = thresholds?.lintErrors ?? Infinity;
  const maxWarnings = thresholds?.lintWarnings ?? Infinity;

  const passed = totalErrors <= maxErrors && totalWarnings <= maxWarnings;

  return { passed, exitCode: passed ? 0 : 1 };
}
