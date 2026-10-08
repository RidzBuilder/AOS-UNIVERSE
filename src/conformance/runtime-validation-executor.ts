import { CONFORMANCE_TESTS } from "./conformance-manifest";
import { executeTest } from "./harness";
import type { ConformanceTestResult } from "./conformance-test";
import type { EvidenceRecord } from "../contracts/evidence-record";
import type { ValidationResult } from "../contracts/validation-result";
import { bindRuntimeAdapter } from "./runtime-adapter-binding";
import { InngestRuntimeAdapter } from "./adapters/inngest-runtime-adapter";
import { inngestCloudBinding } from "./adapters/inngest-cloud-binding";
import type { RuntimeAdapterRequest } from "./runtime-adapter";

type DurableInvocationResult = {
  run_id: string;
  execution_state: string;
  observation: unknown;
  attempt: number;
};

type DurableInvoke = (
  id: string,
  request: RuntimeAdapterRequest,
) => Promise<DurableInvocationResult>;

const adapter = new InngestRuntimeAdapter(inngestCloudBinding);

const byId = (id: string) => {
  const test = CONFORMANCE_TESTS.find((item) => item.test_id === id);
  if (!test) throw new Error(`unknown_conformance_test:${id}`);
  return test;
};

function requestFor(testId: string, suffix: string): RuntimeAdapterRequest {
  return {
    execution_id: `aos-conformance-${testId.toLowerCase().replaceAll("_", "-")}-${suffix}`,
    request_reference: `conformance-request:${testId}:${suffix}`,
    authorization_reference: `conformance-authorization:${testId}:${suffix}`,
    workflow_reference: "aos/runtime.probe",
    provider_reference: "inngest",
    idempotency_key: `aos-conformance:${testId}:${suffix}`,
    input: {
      conformance_test_id: testId,
      probe_id: `CONFORMANCE-${testId}-${suffix}`,
    },
  };
}

function validationFor(
  testId: string,
  result: ConformanceTestResult,
  evidence: EvidenceRecord[],
): ValidationResult {
  const test = byId(testId);
  return {
    validation_id: `AOS-VALIDATION-${testId}`,
    requirement_reference: test.requirement_reference,
    criteria_reference: test.validation_criteria.join("|"),
    test_or_assessment_reference: test.test_id,
    observation_reference: result.test_id,
    evidence_reference: evidence[0]?.evidence_id ?? "none",
    result_state: result.result_state,
    evaluator: "AOS-CONTROLLED-RUNTIME-VALIDATOR",
    timestamp: new Date().toISOString(),
  };
}

function linkEvidence(
  evidence: EvidenceRecord[],
  validationId: string,
): EvidenceRecord[] {
  return evidence.map((item) => ({
    ...item,
    validation_reference: validationId,
  }));
}

export async function executeControlledRuntimeValidation(
  durableInvoke?: DurableInvoke,
): Promise<{
  adapter_id: string;
  capability_boundary: readonly string[];
  results: ConformanceTestResult[];
  evidence: EvidenceRecord[];
  validations: ValidationResult[];
}> {
  const results: ConformanceTestResult[] = [];
  const evidence: EvidenceRecord[] = [];
  const validations: ValidationResult[] = [];

  const governance = byId("AOS-GOVERNANCE-001");
  const governanceBinding = bindRuntimeAdapter(governance, adapter);
  if (governanceBinding.readiness === "READY_TO_VALIDATE") {
    const observation = await adapter.authorize(requestFor(governance.test_id, "01"));
    const result = executeTest(
      governance,
      "Authorization precondition was observed, but no controlled unauthorized execution scenario exists. The family criterion remains unproven.",
      observation.evidence.map((item) => item.evidence_id),
      "AOS-VALIDATION-GOVERNANCE-BOUNDARY-001",
      "BLOCKED",
    );
    const validation = validationFor(governance.test_id, result, observation.evidence);
    results.push(result);
    evidence.push(...linkEvidence(observation.evidence, validation.validation_id));
    validations.push(validation);
  }

  if (!durableInvoke) {
    throw new Error("durable_execution_boundary_required");
  }

  const state = byId("AOS-STATE-001");
  const stateRequest = requestFor(state.test_id, "01");
  const stateInvocation = await durableInvoke("state-observation", stateRequest);
  const stateObservation = adapter.normalizeDurableInvocation(stateRequest, stateInvocation);
  const stateResult = executeTest(
    state,
    "A real child Inngest run was invoked through the durable execution boundary and its run identity/output were observed. The canonical AOS state-transition model is not yet bound, so conformance remains BLOCKED.",
    stateObservation.evidence.map((item) => item.evidence_id),
    "AOS-VALIDATION-STATE-BOUNDARY-002",
    "BLOCKED",
  );
  const stateValidation = validationFor(state.test_id, stateResult, stateObservation.evidence);
  results.push(stateResult);
  evidence.push(...linkEvidence(stateObservation.evidence, stateValidation.validation_id));
  validations.push(stateValidation);

  const evidenceTest = byId("AOS-EVIDENCE-001");
  const evidenceRequest = requestFor(evidenceTest.test_id, "01");
  const evidenceInvocation = await durableInvoke("evidence-observation", evidenceRequest);
  const evidenceObservation = adapter.normalizeDurableInvocation(evidenceRequest, evidenceInvocation);
  const evidenceComplete = evidenceObservation.evidence.every(
    (item) =>
      Boolean(item.source_reference) &&
      Boolean(item.provenance) &&
      Boolean(item.timestamp),
  );
  const evidenceResult = executeTest(
    evidenceTest,
    evidenceComplete
      ? "Real provider evidence was captured through durable invocation with source, provenance and timestamp."
      : "Required canonical evidence fields are incomplete.",
    evidenceObservation.evidence.map((item) => item.evidence_id),
    "AOS-VALIDATION-EVIDENCE-BOUNDARY-002",
    evidenceComplete ? "PASS" : "BLOCKED",
  );
  const evidenceValidation = validationFor(evidenceTest.test_id, evidenceResult, evidenceObservation.evidence);
  results.push(evidenceResult);
  evidence.push(...linkEvidence(evidenceObservation.evidence, evidenceValidation.validation_id));
  validations.push(evidenceValidation);

  const idempotency = byId("AOS-IDEMPOTENCY-001");
  const idempotencyRequest = requestFor(idempotency.test_id, "01");
  const first = await durableInvoke("idempotency-observation", idempotencyRequest);
  const repeated = await durableInvoke("idempotency-observation", idempotencyRequest);
  const firstObservation = adapter.normalizeDurableInvocation(idempotencyRequest, first);
  const repeatedObservation = adapter.normalizeDurableInvocation(idempotencyRequest, repeated);
  const sameRun = first.run_id === repeated.run_id;
  const idempotencyResult = executeTest(
    idempotency,
    sameRun
      ? "The repeated equivalent request reused the same durable invocation result/run identity; no second child execution was observed."
      : "The repeated equivalent request produced a different child run identity; duplicate-effect semantics are not established.",
    [...firstObservation.evidence, ...repeatedObservation.evidence].map((item) => item.evidence_id),
    "AOS-VALIDATION-IDEMPOTENCY-BOUNDARY-002",
    sameRun ? "PASS" : "BLOCKED",
  );
  const idempotencyValidation = validationFor(
    idempotency.test_id,
    idempotencyResult,
    firstObservation.evidence,
  );
  results.push(idempotencyResult);
  evidence.push(
    ...linkEvidence(
      [...firstObservation.evidence, ...repeatedObservation.evidence],
      idempotencyValidation.validation_id,
    ),
  );
  validations.push(idempotencyValidation);

  return {
    adapter_id: adapter.adapter_id,
    capability_boundary: adapter.capabilities,
    results,
    evidence,
    validations,
  };
}
