import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

function getLineCount(content) {
  if (!content) {
    return 0;
  }

  return content.split(/\r?\n/).length;
}

async function walkFiles(dir, extensions) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath, extensions)));
      continue;
    }

    if (entry.isFile() && extensions.includes(path.extname(fullPath))) {
      files.push(fullPath);
    }
  }

  return files;
}

function getFunctionName(node, sourceFile) {
  if (ts.isFunctionDeclaration(node) && node.name) {
    return node.name.getText(sourceFile);
  }

  if (ts.isMethodDeclaration(node) && node.name) {
    return node.name.getText(sourceFile);
  }

  if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && node.parent) {
    if (ts.isVariableDeclaration(node.parent) && node.parent.name) {
      return node.parent.name.getText(sourceFile);
    }
    if (ts.isPropertyAssignment(node.parent) && node.parent.name) {
      return node.parent.name.getText(sourceFile);
    }
  }

  return "(anonymous)";
}

function isFunctionLikeNode(node) {
  return ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node);
}

export async function runSizeCheck({
  rootDir,
  reportDir,
  thresholds,
  allowed,
  extensions
}) {
  const absoluteRoot = path.resolve(process.cwd(), rootDir ?? "app");
  const extensionList = Array.isArray(extensions) && extensions.length > 0 ? extensions : [".tsx"];
  const tsxFileThreshold = Number(thresholds?.tsxFileLines ?? 350);
  const functionThreshold = Number(thresholds?.functionLines ?? 70);
  const allowedFileSet = new Set(allowed?.largeFiles ?? []);
  const allowedFunctionSet = new Set(allowed?.largeFunctions ?? []);

  await fs.mkdir(reportDir, { recursive: true });

  const files = await walkFiles(absoluteRoot, extensionList);
  const largeFiles = [];
  const largeFunctions = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    const lineCount = getLineCount(content);
    const relativePath = path.relative(process.cwd(), filePath).replaceAll("\\", "/");

    if (lineCount > tsxFileThreshold) {
      largeFiles.push({
        file: relativePath,
        lines: lineCount,
        threshold: tsxFileThreshold
      });
    }

    const scriptKind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind);

    function visit(node) {
      if (isFunctionLikeNode(node)) {
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
        const length = end - start + 1;

        if (length > functionThreshold) {
          largeFunctions.push({
            file: relativePath,
            name: getFunctionName(node, sourceFile),
            startLine: start,
            endLine: end,
            lines: length,
            threshold: functionThreshold
          });
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  const report = {
    warningOnly: false,
    blocking: true,
    thresholds: {
      tsxFileLines: tsxFileThreshold,
      functionLines: functionThreshold
    },
    summary: {
      scannedFiles: files.length,
      largeFileWarnings: largeFiles.length,
      largeFunctionWarnings: largeFunctions.length
    },
    allowedBaseline: {
      largeFiles: Array.from(allowedFileSet),
      largeFunctions: Array.from(allowedFunctionSet)
    },
    largeFiles,
    largeFunctions
  };

  const largeFileKeys = largeFiles.map((entry) => entry.file);
  const largeFunctionKeys = largeFunctions.map((entry) => `${entry.file}::${entry.name}::${entry.startLine}`);
  const newLargeFiles = largeFiles.filter((entry) => !allowedFileSet.has(entry.file));
  const newLargeFunctions = largeFunctions.filter(
    (entry) => !allowedFunctionSet.has(`${entry.file}::${entry.name}::${entry.startLine}`)
  );

  report.currentViolationKeys = {
    largeFiles: largeFileKeys,
    largeFunctions: largeFunctionKeys
  };
  report.newViolations = {
    largeFiles: newLargeFiles,
    largeFunctions: newLargeFunctions
  };
  report.passed = newLargeFiles.length === 0 && newLargeFunctions.length === 0;

  await fs.writeFile(path.join(reportDir, "size-warnings.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return {
    passed: report.passed,
    exitCode: report.passed ? 0 : 1
  };
}
