import path from "node:path";

export function getConfigPathFromArgs(argv) {
  const configFlagIndex = argv.indexOf("--config");
  const configPath = configFlagIndex >= 0 ? argv[configFlagIndex + 1] : "quality.config.ts";

  if (!configPath) {
    throw new Error("Expected a file path after --config");
  }

  return path.resolve(process.cwd(), configPath);
}
