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
  execution?: ExecutionRecord;
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
  if (bundle.execution && bundle.spine.execution_reference !== bundle.execution.execution_id) {
    reasons.push("execution_reference_mismatch");
  }
  if (!bundle.execution && bundle.spine.execution_reference) {
    reasons.push("unexpected_execution_reference_without_execution");
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

export interface ConformanceEvidenceSpineAudit {
  status: "PASS" | "PARTIAL" | "FAIL";
  checked_results: number;
  complete_results: number;
  issues: string[];
  spines: ConformanceEvidenceSpine[];
}

export function auditConformanceEvidenceSpines(
  results: readonly ConformanceTestResult[],
  evidence: readonly EvidenceRecord[],
  validations: readonly ValidationResult[],
): ConformanceEvidenceSpineAudit {
  const issues: string[] = [];
  const spines: ConformanceEvidenceSpine[] = [];
  const evidenceById = new Map(evidence.map((item) => [item.evidence_id, item]));
  const validationById = new Map(validations.map((item) => [item.validation_id, item]));

  for (const result of results) {
    const validation = validationById.get(result.validation_reference);
    if (!validation) {
      issues.push(`validation_unresolved:${result.test_id}:${result.validation_reference}`);
      continue;
    }

    const evidenceReferences = result.evidence_references;
    if (result.result_state === "PASS" && evidenceReferences.length === 0) {
      issues.push(`pass_without_evidence:${result.test_id}`);
      continue;
    }

    const unresolved = evidenceReferences.filter((id) => !evidenceById.has(id));
    if (unresolved.length) {
      issues.push(`evidence_unresolved:${result.test_id}:${unresolved.join(",")}`);
      continue;
    }

    const linkedEvidence = evidenceReferences
      .map((id) => evidenceById.get(id))
      .filter((item): item is EvidenceRecord => Boolean(item));

    const linkageErrors = linkedEvidence.filter(
      (item) => item.validation_reference !== validation.validation_id,
    );
    if (linkageErrors.length) {
      issues.push(`evidence_validation_linkage_mismatch:${result.test_id}`);
      continue;
    }

    if (
      validation.requirement_reference !== result.requirement_reference ||
      validation.test_or_assessment_reference !== result.test_id ||
      validation.result_state !== result.result_state
    ) {
      issues.push(`validation_result_mismatch:${result.test_id}`);
      continue;
    }

    const executionReference = linkedEvidence
      .map((item) =>
        item.observation &&
        typeof item.observation === "object" &&
        "execution_id" in item.observation &&
        typeof (item.observation as { execution_id?: unknown }).execution_id === "string"
          ? (item.observation as { execution_id: string }).execution_id
          : undefined,
      )
      .find(Boolean);

    spines.push({
      requirement_reference: result.requirement_reference,
      capability_reference: `capability:runtime-family:${result.test_id}`,
      test_reference: result.test_id,
      execution_reference: executionReference,
      observation_reference: validation.observation_reference,
      evidence_references: evidenceReferences,
      validation_reference: validation.validation_id,
      conformance_result_reference: result.test_id,
      decision_reference: validation.decision_reference,
    });
  }

  const complete_results = spines.length;
  const status =
    issues.length === 0
      ? "PASS"
      : complete_results > 0
        ? "PARTIAL"
        : "FAIL";

  return {
    status,
    checked_results: results.length,
    complete_results,
    issues,
    spines,
  };
}
