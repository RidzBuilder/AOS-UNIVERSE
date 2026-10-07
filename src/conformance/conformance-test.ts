export type ConformanceResultState =
  | "PASS"
  | "FAIL"
  | "BLOCKED"
  | "PARTIAL"
  | "REQUIRES_REVIEW"
  | "INVALIDATED"
  | "SUPERSEDED";

export type ConformanceExecutionMode = "STATIC" | "RUNTIME" | "E2E";

export interface ConformanceTestDefinition {
  test_id: string;
  family: string;
  requirement_reference: string;
  mode: ConformanceExecutionMode;
  preconditions: string[];
  inputs: string[];
  expected_behavior: string[];
  evidence_requirements: string[];
  validation_criteria: string[];
  provider_neutral: boolean;
}

export interface ConformanceTestResult {
  test_id: string;
  requirement_reference: string;
  result_state: ConformanceResultState;
  observation: string;
  evidence_references: string[];
  validation_reference: string;
  decision_reference?: string;
  execution_timestamp: string;
}

export const RESULT_STATES: readonly ConformanceResultState[] = [
  "PASS",
  "FAIL",
  "BLOCKED",
  "PARTIAL",
  "REQUIRES_REVIEW",
  "INVALIDATED",
  "SUPERSEDED",
];
