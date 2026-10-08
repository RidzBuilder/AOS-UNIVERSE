import type { ExecutionRecord } from "../contracts/execution-record";
import type { EvidenceRecord } from "../contracts/evidence-record";
import type { ValidationResult } from "../contracts/validation-result";
import type { ConformanceTestResult } from "./conformance-test";

export interface ConformanceEvidenceSpine {
  requirement_reference: string;
  capability_reference: string;
  test_reference: string;
  execution_reference: string;
  observation_reference: string;
  evidence_references: string[];
  validation_reference: string;
  conformance_result_reference: string;
  decision_reference?: string;
  gate_reference?: string;
}

export interface ConformanceEvidenceBundle {
  spine: ConformanceEvidenceSpine;
  execution: ExecutionRecord;
  evidence: EvidenceRecord[];
  validation: ValidationResult;
  conformance_result: ConformanceTestResult;
}

/**
 * Provider-neutral traceability contract.
 * Does not persist evidence, authorize progression, or declare provider conformance.
 */
export function validateConformanceEvidenceSpine(
  bundle: ConformanceEvidenceBundle,
): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (bundle.spine.requirement_reference !== bundle.validation.requirement_reference) {
    reasons.push("requirement_reference_mismatch");
  }
  if (bundle.spine.execution_reference !== bundle.execution.execution_id) {
    reasons.push("execution_reference_mismatch");
  }
  if (bundle.spine.validation_reference !== bundle.validation.validation_id) {
    reasons.push("validation_reference_mismatch");
  }
  if (bundle.spine.conformance_result_reference !== bundle.conformance_result.test_id) {
    reasons.push("conformance_result_reference_mismatch");
  }
  if (bundle.spine.evidence_references.length === 0) {
    reasons.push("evidence_reference_missing");
  }

  const evidenceIds = new Set(bundle.evidence.map((item) => item.evidence_id));
  for (const reference of bundle.spine.evidence_references) {
    if (!evidenceIds.has(reference)) {
      reasons.push(`evidence_reference_unresolved:${reference}`);
    }
  }

  return { valid: reasons.length === 0, reasons };
}
