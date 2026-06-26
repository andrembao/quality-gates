export function parseCounterLine(line) {
  if (!line) {
    return null;
  }

  const passed = Number((line.match(/(\d+)\s+passed/) ?? [])[1] ?? 0);
  const failed = Number((line.match(/(\d+)\s+failed/) ?? [])[1] ?? 0);
  const skipped = Number((line.match(/(\d+)\s+skipped/) ?? [])[1] ?? 0);
  const totalFromLine = Number((line.match(/\((\d+)\)/) ?? [])[1] ?? 0);
  const total = totalFromLine > 0 ? totalFromLine : passed + failed + skipped;

  return {
    total,
    passed,
    failed,
    skipped
  };
}

export function parseVitestExecution(output, exitCode) {
  const lines = output.split(/\r?\n/);
  const filesLine = lines.find((line) => line.includes("Test Files"));
  const testsLine = lines.find((line) => line.trim().startsWith("Tests"));
  const durationLine = lines.find((line) => line.includes("Duration"));

  return {
    command: "npm run test:unit:coverage",
    exitCode,
    files: parseCounterLine(filesLine),
    tests: parseCounterLine(testsLine),
    duration: durationLine ? durationLine.trim().replace(/^Duration\s+/, "") : null
  };
}

export function parsePlaywrightExecution(output, exitCode) {
  const runningLineMatch = output.match(/Running\s+(\d+)\s+tests?\s+using\s+(\d+)\s+worker/);
  const passedMatches = [...output.matchAll(/\b(\d+)\s+passed\b(?:\s*\(([^)]+)\))?/g)];
  const failedMatches = [...output.matchAll(/\b(\d+)\s+failed\b/g)];
  const skippedMatches = [...output.matchAll(/\b(\d+)\s+skipped\b/g)];

  const passedMatch = passedMatches.at(-1);
  const failedMatch = failedMatches.at(-1);
  const skippedMatch = skippedMatches.at(-1);

  const passed = Number(passedMatch?.[1] ?? 0);
  const failed = Number(failedMatch?.[1] ?? 0);
  const skipped = Number(skippedMatch?.[1] ?? 0);
  const total = Number(runningLineMatch?.[1] ?? passed + failed + skipped);

  return {
    command: "npm run test:e2e:coverage",
    exitCode,
    workers: Number(runningLineMatch?.[2] ?? 0),
    tests: {
      total,
      passed,
      failed,
      skipped
    },
    duration: passedMatch?.[2] ?? null
  };
}
