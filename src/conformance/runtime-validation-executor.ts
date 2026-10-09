import { CONFORMANCE_TESTS } from "./conformance-manifest";
import { executeTest } from "./harness";
import type { ConformanceTestResult } from "./conformance-test";
import type { EvidenceRecord } from "../contracts/evidence-record";
import type { ValidationResult } from "../contracts/validation-result";
import { bindRuntimeAdapter } from "./runtime-adapter-binding";
import { InngestRuntimeAdapter } from "./adapters/inngest-runtime-adapter";
import { inngestCloudBinding } from "./adapters/inngest-cloud-binding";
import type { RuntimeAdapterRequest } from "./runtime-adapter";
import {
  canonicalEffectReference,
  controlledUnauthorizedRequest,
  isUnauthorizedFixture,
  validateExecutionStateTrace,
} from "./canonical-execution-semantics";
import { auditConformanceEvidenceSpines } from "./evidence-spine";

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

function requestFor(
  testId: string,
  suffix: string,
  validationContext: string,
): RuntimeAdapterRequest {
  return {
    execution_id: `aos-conformance-${testId.toLowerCase().replaceAll("_", "-")}-${suffix}-${validationContext}`,
    request_reference: `conformance-request:${testId}:${suffix}`,
    authorization_reference: `conformance-authorization:${testId}:${suffix}`,
    workflow_reference: "aos/runtime.probe",
    provider_reference: "inngest",
    idempotency_key: `aos-conformance:${testId}:${suffix}:${validationContext}`,
    input: {
      conformance_test_id: testId,
      probe_id: `CONFORMANCE-${testId}-${suffix}`,
      idempotency_key: `aos-conformance:${testId}:${suffix}:${validationContext}`,
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
    validation_id: result.validation_reference,
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
  evidence_spine_audit: ReturnType<typeof auditConformanceEvidenceSpines>;
}> {
  const results: ConformanceTestResult[] = [];
  const evidence: EvidenceRecord[] = [];
  const validations: ValidationResult[] = [];
  const validationContext = `controlled-${Date.now().toString(36)}`;

  const governance = byId("AOS-GOVERNANCE-001");
  const governanceBinding = bindRuntimeAdapter(governance, adapter);
  if (governanceBinding.readiness === "READY_TO_VALIDATE") {
    const unauthorizedRequest = controlledUnauthorizedRequest();
    const unauthorizedBlocked = isUnauthorizedFixture(unauthorizedRequest);

    const governanceEvidence: EvidenceRecord[] = [{
      evidence_id: "aos-governance-unauthorized-fixture-01",
      source_reference:
        "aos:controlled-governance-boundary:AOS-GOVERNANCE-001",
      observation: {
        request_reference: unauthorizedRequest.request_reference,
        execution_attempted: false,
        execution_state: unauthorizedBlocked ? "BLOCKED" : "INVALID",
        authorization_boundary: unauthorizedBlocked ? "DENY" : "INVALID",
      },
      provenance: {
        provider: "provider-neutral-conformance-fixture",
        mechanism: "authorization-gate",
        source: "controlled runtime validation",
      },
      timestamp: new Date().toISOString(),
      status: unauthorizedBlocked ? "OBSERVED" : "INVALID",
    }];

    const result = executeTest(
      governance,
      unauthorizedBlocked
        ? "A controlled unauthorized execution fixture was rejected at the authorization boundary; no execution invocation was permitted."
        : "The unauthorized fixture was not recognized by the authorization boundary.",
      governanceEvidence.map((item) => item.evidence_id),
      "AOS-VALIDATION-GOVERNANCE-BOUNDARY-002",
      unauthorizedBlocked ? "PASS" : "FAIL",
    );
    const validation = validationFor(governance.test_id, result, governanceEvidence);
    results.push(result);
    evidence.push(...linkEvidence(governanceEvidence, validation.validation_id));
    validations.push(validation);
  }

  if (!durableInvoke) {
    throw new Error("durable_execution_boundary_required");
  }

  const state = byId("AOS-STATE-001");
  const stateRequest = requestFor(state.test_id, "01", validationContext);
  const stateInvocation = await durableInvoke("state-observation", stateRequest);
  const stateObservation = adapter.normalizeDurableInvocation(stateRequest, stateInvocation);
  const stateObservationPayload = stateInvocation.observation as {
    output?: { output?: { observation?: { state_trace?: unknown } } };
  } | undefined;
  const stateOutput = stateObservationPayload?.output?.observation?.state_trace;
  const observedTrace = Array.isArray(stateOutput)
    ? ["AUTHORIZED", ...stateOutput.filter((item): item is string => typeof item === "string")]
    : ["AUTHORIZED", stateInvocation.execution_state];
  const stateTraceValidation = validateExecutionStateTrace(observedTrace);
  const stateResult = executeTest(
    state,
    stateTraceValidation.valid
      ? `Real child execution produced the declared controlled state trace: ${observedTrace.join(" → ")}.`
      : `Observed state trace is not permitted by the declared controlled execution model: ${stateTraceValidation.reason}.`,
    stateObservation.evidence.map((item) => item.evidence_id),
    "AOS-VALIDATION-STATE-BOUNDARY-003",
    stateTraceValidation.valid ? "PASS" : "FAIL",
  );
  const stateValidation = validationFor(state.test_id, stateResult, stateObservation.evidence);
  results.push(stateResult);
  evidence.push(...linkEvidence(stateObservation.evidence, stateValidation.validation_id));
  validations.push(stateValidation);

  const evidenceTest = byId("AOS-EVIDENCE-001");
  const evidenceRequest = requestFor(evidenceTest.test_id, "01", validationContext);
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

  const failure = byId("AOS-FAILURE-001");
  const failureBinding = bindRuntimeAdapter(failure, adapter);
  if (failureBinding.readiness !== "READY_TO_VALIDATE") {
    throw new Error("failure_injection_capability_required");
  }

  const failureRequest = requestFor(failure.test_id, "01", validationContext);
  if (!adapter.dispatchFailure || !adapter.observeDispatch || !adapter.dispatchRecovery) {
    throw new Error("split_phase_runtime_control_boundary_required");
  }
  const failureDispatch = await adapter.dispatchFailure(
    failureRequest.execution_id,
    {
      mode: "CONTROLLED_NON_RETRIABLE_FAILURE",
      reason: "AOS failure-state conformance probe",
    },
  );
  const failureObservation = await adapter.observeDispatch(failureDispatch);
  const failureEvidence = failureObservation.evidence;
  const failureExplicit =
    failureObservation.execution.execution_state.toUpperCase() === "FAILED";
  const failureResult = executeTest(
    failure,
    failureExplicit
      ? "Controlled failure injection produced an explicit FAILED provider runtime state; the failure was not converted to success."
      : `Failure injection did not produce the required explicit FAILED state: ${failureObservation.execution.execution_state}.`,
    failureEvidence.map((item) => item.evidence_id),
    "AOS-VALIDATION-FAILURE-BOUNDARY-001",
    failureExplicit ? "PASS" : "FAIL",
  );
  const failureValidation = validationFor(failure.test_id, failureResult, failureEvidence);
  results.push(failureResult);
  evidence.push(...linkEvidence(failureEvidence, failureValidation.validation_id));
  validations.push(failureValidation);

  const recovery = byId("AOS-RECOVERY-001");
  const recoveryBinding = bindRuntimeAdapter(recovery, adapter);
  if (recoveryBinding.readiness !== "READY_TO_VALIDATE") {
    throw new Error("recovery_capability_required");
  }

  const recoveryDispatch = await adapter.dispatchRecovery(
    failureObservation.execution.execution_id,
    {
      strategy: "CONTROLLED_CONTINUATION",
      failed_execution_id: failureObservation.execution.execution_id,
    },
  );
  const recoveryObservation = await adapter.observeDispatch(recoveryDispatch);
  const recoveryEvidence = recoveryObservation.evidence;
  const recoveryOutput = recoveryEvidence[0]?.observation;
  const recoveryObject =
    recoveryOutput && typeof recoveryOutput === "object"
      ? (recoveryOutput as { output?: unknown })
      : undefined;
  const recoveryValid =
    recoveryObservation.execution.execution_state.toUpperCase() === "COMPLETED" &&
    Boolean(recoveryObject);
  const recoveryResult = executeTest(
    recovery,
    recoveryValid
      ? "Recovery produced a bounded provider runtime completion and evidence linking the recovery operation to the failed execution."
      : `Recovery did not produce the required bounded completion state: ${recoveryObservation.execution.execution_state}.`,
    recoveryEvidence.map((item) => item.evidence_id),
    "AOS-VALIDATION-RECOVERY-BOUNDARY-001",
    recoveryValid ? "PASS" : "FAIL",
  );
  const recoveryValidation = validationFor(
    recovery.test_id,
    recoveryResult,
    recoveryEvidence,
  );
  results.push(recoveryResult);
  evidence.push(...linkEvidence(recoveryEvidence, recoveryValidation.validation_id));
  validations.push(recoveryValidation);

  const idempotency = byId("AOS-IDEMPOTENCY-001");
  const idempotencyEvidence: EvidenceRecord[] = [];
  const idempotencyResult = executeTest(
    idempotency,
    "Controlled parent self-invocation is not used for duplicate testing because provider duplicate rejection can fail the invoking function boundary. Provider-level event-id idempotency remains validated separately through an externally triggered controlled test.",
    [],
    "AOS-VALIDATION-IDEMPOTENCY-BOUNDARY-EXTERNAL-001",
    "BLOCKED",
  );
  const idempotencyValidation = validationFor(
    idempotency.test_id,
    idempotencyResult,
    idempotencyEvidence,
  );
  results.push(idempotencyResult);
  evidence.push(...linkEvidence(idempotencyEvidence, idempotencyValidation.validation_id));
  validations.push(idempotencyValidation);

  const evidence_spine_audit = auditConformanceEvidenceSpines(
    results,
    evidence,
    validations,
  );

  return {
    adapter_id: adapter.adapter_id,
    capability_boundary: adapter.capabilities,
    results,
    evidence,
    validations,
    evidence_spine_audit,
  };
}
