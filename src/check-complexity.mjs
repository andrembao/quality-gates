import fs from "node:fs/promises";
import path from "node:path";
import { runCommand } from "./process.mjs";

const COMPLEXITY_RULES = new Set(["complexity", "sonarjs/cognitive-complexity"]);

export async function runComplexityCheck({ reportDir, command, thresholds }) {
  await fs.mkdir(reportDir, { recursive: true });

  const cyclomaticMax = thresholds?.cyclomaticComplexity ?? 10;
  const lintCommand = command ?? "npx eslint .";
  const rawFile = path.join(reportDir, ".complexity-raw.json");

  // Inject cyclomatic complexity rule inline; sonarjs/cognitive-complexity requires plugin in project
  const jsonCommand = `${lintCommand} --rule 'complexity: ["warn", ${cyclomaticMax}]' --format json --output-file ${rawFile}`;

  await runCommand(jsonCommand);

  let rawResults = [];
  try {
    rawResults = JSON.parse(await fs.readFile(rawFile, "utf8"));
  } catch {
    // no output file — config error or nothing to lint
  }

  const complexityResults = rawResults
    .map((file) => {
      const messages = (file.messages ?? []).filter((m) => COMPLEXITY_RULES.has(m.ruleId));
      return { ...file, messages, errorCount: messages.length, warningCount: 0 };
    })
    .filter((file) => file.messages.length > 0);

  await fs.writeFile(
    path.join(reportDir, "complexity.json"),
    `${JSON.stringify(complexityResults, null, 2)}\n`,
    "utf8"
  );

  await fs.unlink(rawFile).catch(() => {});

  const passed = complexityResults.length === 0;

  return { passed, exitCode: passed ? 0 : 1 };
}
