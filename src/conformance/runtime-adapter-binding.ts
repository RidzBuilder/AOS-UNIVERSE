import type { ConformanceTestDefinition } from "./conformance-test";
import type {
  RuntimeAdapterCapability,
  RuntimeConformanceAdapter,
} from "./runtime-adapter";

export type RuntimeFamilyReadiness =
  | "READY_TO_VALIDATE"
  | "MISSING_CAPABILITY"
  | "REQUIRES_SECOND_PROVIDER"
  | "REQUIRES_GOLDEN_PATH_AUTHORIZATION";

export interface RuntimeFamilyBinding {
  test_id: string;
  required_capabilities: readonly RuntimeAdapterCapability[];
  readiness: RuntimeFamilyReadiness;
  rationale: string;
}

const CAPABILITY_BINDINGS: Record<
  string,
  readonly RuntimeAdapterCapability[]
> = {
  "AOS-GOVERNANCE-001": ["AUTHORIZATION"],
  "AOS-STATE-001": ["STATE_OBSERVATION"],
  "AOS-EVIDENCE-001": ["EVIDENCE_CAPTURE"],
  "AOS-FAILURE-001": ["FAILURE_INJECTION"],
  "AOS-RECOVERY-001": ["RECOVERY_RETRY"],
  "AOS-IDEMPOTENCY-001": ["IDEMPOTENCY"],
  "AOS-SECURITY-001": ["SECURITY_BOUNDARY"],
  "AOS-OBSERVABILITY-001": ["TRACE_CORRELATION"],
};

export function bindRuntimeAdapter(
  test: ConformanceTestDefinition,
  adapter: RuntimeConformanceAdapter,
): RuntimeFamilyBinding {
  if (test.test_id === "AOS-SUBSTITUTION-001") {
    return {
      test_id: test.test_id,
      required_capabilities: [],
      readiness: "REQUIRES_SECOND_PROVIDER",
      rationale:
        "Provider substitution requires at least two conforming provider implementations; one adapter cannot prove substitution.",
    };
  }

  if (test.test_id === "AOS-GOLDEN-PATH-001") {
    return {
      test_id: test.test_id,
      required_capabilities: [],
      readiness: "REQUIRES_GOLDEN_PATH_AUTHORIZATION",
      rationale:
        "Golden Path requires all prerequisite conformance families to PASS and a separate authorization gate.",
    };
  }

  const required = CAPABILITY_BINDINGS[test.test_id];
  if (!required) {
    return {
      test_id: test.test_id,
      required_capabilities: [],
      readiness: "MISSING_CAPABILITY",
      rationale: "No runtime adapter binding is defined for this test family.",
    };
  }

  const available = new Set(adapter.capabilities);
  const missing = required.filter((capability) => !available.has(capability));

  return {
    test_id: test.test_id,
    required_capabilities: required,
    readiness: missing.length === 0 ? "READY_TO_VALIDATE" : "MISSING_CAPABILITY",
    rationale:
      missing.length === 0
        ? "Required runtime adapter capabilities are represented; execution remains subject to authorization and evidence validation."
        : `Missing runtime adapter capabilities: ${missing.join(", ")}`,
  };
}
