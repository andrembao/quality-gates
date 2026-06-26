import fs from "node:fs/promises";
import path from "node:path";
import { runCommand } from "./process.mjs";

export async function runTypecheck({ reportDir, command }) {
  await fs.mkdir(reportDir, { recursive: true });
  const resolvedCommand = command ?? "npx tsc --noEmit --pretty false";
  const result = await runCommand(resolvedCommand);

  const errors = result.output.match(/error TS\d+/g) ?? [];
  const report = {
    command: resolvedCommand,
    passed: result.code === 0,
    errorCount: errors.length,
    output: result.output.trim()
  };

  await fs.writeFile(path.join(reportDir, "typecheck.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return {
    passed: result.code === 0,
    exitCode: result.code
  };
}
