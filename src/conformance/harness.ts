import {
  CONFORMANCE_TESTS,
} from "./conformance-manifest";
import {
  RESULT_STATES,
  type ConformanceTestDefinition,
  type ConformanceTestResult,
} from "./conformance-test";

export interface HarnessValidationReport {
  harness_id: string;
  status: "PASS" | "FAIL";
  checked_tests: number;
  errors: string[];
  checked_at: string;
}

export function validateHarnessDefinitions(
  tests: readonly ConformanceTestDefinition[] = CONFORMANCE_TESTS,
): HarnessValidationReport {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const test of tests) {
    if (!test.test_id || ids.has(test.test_id)) {
      errors.push(`duplicate_or_missing_test_id:${test.test_id}`);
    }
    ids.add(test.test_id);

    if (!test.family || !test.requirement_reference) {
      errors.push(`missing_identity:${test.test_id}`);
    }
    if (!["STATIC", "RUNTIME", "E2E"].includes(test.mode)) {
      errors.push(`invalid_mode:${test.test_id}`);
    }
    if (!test.provider_neutral) {
      errors.push(`provider_neutrality_violation:${test.test_id}`);
    }
    if (test.preconditions.length === 0 || test.expected_behavior.length === 0) {
      errors.push(`incomplete_definition:${test.test_id}`);
    }
    if (test.evidence_requirements.length === 0 || test.validation_criteria.length === 0) {
      errors.push(`missing_evidence_or_validation:${test.test_id}`);
    }
  }

  if (tests.length !== 12) {
    errors.push(`expected_12_test_families:actual_${tests.length}`);
  }

  if (!RESULT_STATES.includes("PASS") || !RESULT_STATES.includes("BLOCKED")) {
    errors.push("invalid_result_semantics");
  }

  return {
    harness_id: "AOS-CONFORMANCE-HARNESS-v0.1",
    status: errors.length === 0 ? "PASS" : "FAIL",
    checked_tests: tests.length,
    errors,
    checked_at: new Date().toISOString(),
  };
}

export function executeTest(
  test: ConformanceTestDefinition,
  observation: string,
  evidenceReferences: string[],
  validationReference: string,
  resultState: ConformanceTestResult["result_state"],
): ConformanceTestResult {
  if (resultState === "PASS" && evidenceReferences.length === 0) {
    throw new Error(`PASS requires evidence:${test.test_id}`);
  }

  return {
    test_id: test.test_id,
    requirement_reference: test.requirement_reference,
    result_state: resultState,
    observation,
    evidence_references: evidenceReferences,
    validation_reference: validationReference,
    execution_timestamp: new Date().toISOString(),
  };
}
