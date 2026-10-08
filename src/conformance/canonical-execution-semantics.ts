import type { RuntimeAdapterRequest } from "./runtime-adapter";

export const CONTROLLED_EXECUTION_STATE_TRACE = [
  "AUTHORIZED",
  "RUNNING",
  "COMPLETED",
] as const;

const ALLOWED_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  AUTHORIZED: ["RUNNING"],
  RUNNING: ["COMPLETED"],
};

export function validateExecutionStateTrace(
  trace: readonly string[],
): { valid: boolean; reason: string } {
  if (trace.length < 2) {
    return { valid: false, reason: "state_trace_too_short" };
  }

  for (let index = 0; index < trace.length - 1; index += 1) {
    const current = trace[index];
    const next = trace[index + 1];
    if (!ALLOWED_TRANSITIONS[current]?.includes(next)) {
      return {
        valid: false,
        reason: `undeclared_transition:${current}->${next}`,
      };
    }
  }

  return {
    valid: true,
    reason: "declared_controlled_execution_transitions_observed",
  };
}

export function controlledUnauthorizedRequest(): RuntimeAdapterRequest {
  return {
    execution_id: "aos-conformance-governance-unauthorized-fixture-01",
    request_reference: "conformance-request:AOS-GOVERNANCE-001:UNAUTHORIZED-FIXTURE",
    authorization_reference:
      "conformance-authorization:AOS-GOVERNANCE-001:UNAUTHORIZED-FIXTURE",
    workflow_reference: "aos/runtime.probe",
    provider_reference: "inngest",
    input: {
      conformance_test_id: "AOS-GOVERNANCE-001",
      fixture: "UNAUTHORIZED_EXECUTION_ATTEMPT",
    },
  };
}

export function isUnauthorizedFixture(
  request: RuntimeAdapterRequest,
): boolean {
  return (
    typeof request.input === "object" &&
    request.input !== null &&
    (request.input as { fixture?: unknown }).fixture ===
      "UNAUTHORIZED_EXECUTION_ATTEMPT"
  );
}

export function canonicalEffectReference(
  request: RuntimeAdapterRequest,
): string {
  if (!request.idempotency_key) {
    throw new Error("idempotency_context_required");
  }

  return `aos-effect:${request.idempotency_key}`;
}
