import { CONFORMANCE_TESTS } from "./conformance-manifest";
import { executeTest, type ConformanceTestResult } from "./harness";
import { bindRuntimeAdapter } from "./runtime-adapter-binding";
import { InngestRuntimeAdapter } from "./adapters/inngest-runtime-adapter";
import { inngestCloudBinding } from "./adapters/inngest-cloud-binding";
import type { RuntimeAdapterRequest } from "./runtime-adapter";

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

export async function executeControlledRuntimeValidation(): Promise<{
  adapter_id: string;
  capability_boundary: readonly string[];
  results: ConformanceTestResult[];
}> {
  const results: ConformanceTestResult[] = [];

  const governance = byId("AOS-GOVERNANCE-001");
  const governanceBinding = bindRuntimeAdapter(governance, adapter);
  if (governanceBinding.readiness === "READY_TO_VALIDATE") {
    const observation = await adapter.authorize(requestFor(governance.test_id, "01"));
    results.push(
      executeTest(
        governance,
        "Authorized precondition was observed, but the adapter does not expose a controlled unauthorized execution scenario. The family validation criterion therefore remains unproven.",
        observation.evidence.map((item) => item.evidence_id),
        "AOS-VALIDATION-GOVERNANCE-BOUNDARY-001",
        "BLOCKED",
      ),
    );
  }

  const state = byId("AOS-STATE-001");
  const stateObservation = await adapter.start(requestFor(state.test_id, "01"));
  results.push(
    executeTest(
      state,
      "Real provider execution and observation were captured, but the canonical AOS state-transition model is not bound to this runtime observation. No PASS is inferred from provider state alone.",
      stateObservation.evidence.map((item) => item.evidence_id),
      "AOS-VALIDATION-STATE-BOUNDARY-001",
      "BLOCKED",
    ),
  );

  const evidence = byId("AOS-EVIDENCE-001");
  const evidenceObservation = await adapter.start(requestFor(evidence.test_id, "01"));
  const evidenceComplete = evidenceObservation.evidence.every(
    (item) =>
      Boolean(item.source_reference) &&
      Boolean(item.provenance) &&
      Boolean(item.timestamp) &&
      Boolean(item.validation_reference),
  );
  results.push(
    executeTest(
      evidence,
      evidenceComplete
        ? "Canonical evidence fields required by the family were observed."
        : "Provider evidence was captured and normalized, but the current binding does not provide the complete validation linkage required by the family.",
      evidenceObservation.evidence.map((item) => item.evidence_id),
      "AOS-VALIDATION-EVIDENCE-BOUNDARY-001",
      evidenceComplete ? "PASS" : "BLOCKED",
    ),
  );

  const idempotency = byId("AOS-IDEMPOTENCY-001");
  const idempotencyRequest = requestFor(idempotency.test_id, "01");
  const first = await adapter.start(idempotencyRequest);
  try {
    const repeated = await adapter.repeat(idempotencyRequest);
    results.push(
      executeTest(
        idempotency,
        "Repeated execution produced an additional provider observation. The current implementation does not establish duplicate-effect semantics from that observation alone.",
        [...first.evidence, ...repeated.evidence].map((item) => item.evidence_id),
        "AOS-VALIDATION-IDEMPOTENCY-BOUNDARY-001",
        "BLOCKED",
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push(
      executeTest(
        idempotency,
        `Provider rejected the repeated request: ${message}. Provider mechanics are observed, but the duplicate-rejection outcome is not yet represented as a canonical adapter validation result.`,
        first.evidence.map((item) => item.evidence_id),
        "AOS-VALIDATION-IDEMPOTENCY-BOUNDARY-001",
        "BLOCKED",
      ),
    );
  }

  return {
    adapter_id: adapter.adapter_id,
    capability_boundary: adapter.capabilities,
    results,
  };
}
