# @andrembao/quality-gates

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![npm](https://img.shields.io/npm/v/@andrembao/quality-gates)](https://www.npmjs.com/package/@andrembao/quality-gates)

> **Maintained entirely by AI agents.** This project is developed and maintained exclusively through AI-assisted workflows (Claude Code / Anthropic). No human code authorship. Contributions via issues and pull requests are welcome.

Reusable quality gate pipeline and HTML report generator for Node.js / TypeScript projects.

Define your thresholds once in `quality.config.ts`. Run a single command to enforce typecheck, bundle size, E2E coverage, and more — with a consolidated HTML report.

---

## What it does

- Orchestrates multiple quality checks in sequence
- Blocks the pipeline on failures (configurable per check)
- Generates a single HTML report with all results
- Ships as standalone CLI binaries — no build step required in consumer projects

## CLI commands

| Command | Description |
|---|---|
| `quality-run` | Run all checks and generate report |
| `quality-report` | Generate report from existing check results |
| `quality-check-typecheck` | Run TypeScript typecheck gate |
| `quality-check-size` | Run file/function size gate |
| `quality-check-e2e` | Run E2E coverage gate |

---

## Install

```bash
npm install --save-dev @andrembao/quality-gates
```

---

## Quick start

### 1. Create `quality.config.ts` in your project root

```ts
import type { QualityConfig } from "@andrembao/quality-gates";

const qualityConfig: QualityConfig = {
  reportDir: "report",
  reportFile: "quality-report.html",
  thresholds: {
    lintWarnings: 0,
    lintErrors: 0,
    typecheckErrors: 0,
    cyclomaticComplexity: 45,
    cognitiveComplexity: 50,
    unitCoverage: 70,
    e2eCoverage: 50,
    duplication: 5,
    mutation: 60,
    tsxFileLinesWarning: 350,
    functionLinesWarning: 70
  },
  paths: {
    typecheckCommand: "npx tsc --noEmit --pretty false"
  },
  size: {
    rootDir: "app",
    extensions: [".tsx"],
    allowed: {
      largeFiles: [],
      largeFunctions: []
    }
  },
  e2e: {
    reportDir: ".coverage/e2e",
    browserCoverageDir: ".coverage/e2e/browser",
    requireAllTargets: true,
    targetFiles: [
      "app/components/MyComponent.tsx"
    ]
  },
  checks: [
    { id: "lint",        label: "Lint",         command: "npm run lint",               blocking: true },
    { id: "typecheck",   label: "Typecheck",     command: "npm run typecheck",          blocking: true },
    { id: "sizeWarnings",label: "Size",          command: "npm run test:size:warnings", blocking: true },
    { id: "unitCoverage",label: "Unit coverage", command: "npm run test:unit:coverage", blocking: true },
    { id: "e2eCoverage", label: "E2E coverage",  command: "npm run test:e2e:coverage",  blocking: true }
  ]
};

export default qualityConfig;
```

### 2. Add scripts to your `package.json`

```json
{
  "scripts": {
    "typecheck": "quality-check-typecheck --config quality.config.ts",
    "test:size:warnings": "quality-check-size --config quality.config.ts",
    "test:e2e:coverage": "playwright test && quality-check-e2e --config quality.config.ts",
    "report:quality": "quality-report --config quality.config.ts",
    "test:quality": "quality-run --config quality.config.ts"
  }
}
```

### 3. Run

```bash
npm run test:quality
```

---

## Outputs

After a run, the following files are written to `reportDir`:

| File | Description |
|---|---|
| `quality-run.json` | Full pipeline result (pass/fail per check) |
| `test-execution-summary.json` | Per-check execution details |
| `quality-report.html` | Consolidated visual report |

---

## Configuration reference

| Field | Type | Description |
|---|---|---|
| `reportDir` | `string` | Directory where output files are written |
| `reportFile` | `string` | HTML report filename |
| `thresholds` | `object` | Numeric limits for each gate |
| `paths.typecheckCommand` | `string` | Command used by the typecheck gate |
| `size.rootDir` | `string` | Root dir scanned for size checks |
| `size.extensions` | `string[]` | File extensions to check |
| `size.allowed.largeFiles` | `string[]` | Files explicitly allowed to exceed the line limit |
| `size.allowed.largeFunctions` | `string[]` | Functions explicitly allowed to exceed the line limit |
| `e2e.reportDir` | `string` | Directory with E2E coverage output |
| `e2e.browserCoverageDir` | `string` | Directory with per-file browser coverage JSON files |
| `e2e.requireAllTargets` | `boolean` | Fail if any `targetFiles` entry has no coverage |
| `e2e.targetFiles` | `string[]` | Files that must be covered by E2E tests |
| `checks` | `array` | Ordered list of checks to run |

---

## Publishing

This package is published to the public npm registry under `@andrembao/quality-gates`.

To publish a new version:

```bash
npm version patch   # or minor / major
npm publish
```

---

## Contributing

Issues and pull requests are welcome. Keep in mind this project is AI-maintained — PRs are reviewed and merged by AI agents.

---

## License

[MIT](./LICENSE)
