export interface QualityThresholds {
  lintWarnings: number;
  lintErrors: number;
  typecheckErrors: number;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  unitCoverage: number;
  e2eCoverage: number;
  duplication: number;
  mutation: number;
  tsxFileLinesWarning: number;
  functionLinesWarning: number;
}

export interface QualityCheckDefinition {
  id: string;
  label: string;
  command: string;
  blocking: boolean;
}

export interface QualityConfig {
  reportDir?: string;
  reportFile?: string;
  thresholds: QualityThresholds;
  checks: QualityCheckDefinition[];
  paths?: {
    typecheckCommand?: string;
    lintCommand?: string;
  };
  size?: {
    rootDir?: string;
    extensions?: string[];
    allowed?: {
      largeFiles?: string[];
      largeFunctions?: string[];
    };
  };
  e2e?: {
    reportDir?: string;
    browserCoverageDir?: string;
    requireAllTargets?: boolean;
    targetFiles?: string[];
  };
}

export function runQualityPipeline(config: QualityConfig): Promise<{
  passed: boolean;
  blockingFailures: string[];
}>;
