import type { ExecutionRecord } from "../../contracts/execution-record";
import type { EvidenceRecord } from "../../contracts/evidence-record";
import type { ValidationResult } from "../../contracts/validation-result";
import type {
  RuntimeAdapterCapability,
  RuntimeAdapterObservation,
  RuntimeAdapterRequest,
  RuntimeConformanceAdapter,
} from "../runtime-adapter";

/**
 * Provider-side observation returned by the Inngest binding.
 *
 * The binding owns all Inngest SDK/API mechanics. The conformance adapter
 * only normalizes those observations into the canonical AOS records.
 */
export interface InngestRuntimeSnapshot {
  execution: {
    execution_id: string;
    request_reference: string;
    authorization_reference: string;
    workflow_reference: string;
    runtime_reference: string;
    provider_reference: string;
    execution_state: string;
    timestamps: Record<string, string>;
    attempts: number;
    result_reference?: string;
    artifact_references?: string[];
    failure_recovery_references?: string[];
    trace_reference?: string;
  };
  evidence: Array<{
    evidence_id: string;
    source_reference: string;
    artifact_reference?: string;
    claim_or_finding_reference?: string;
    observation: unknown;
    provenance: unknown;
    timestamp: string;
    validation_reference?: string;
    integrity_reference?: string;
    status: string;
  }>;
  validation?: {
    validation_id: string;
    requirement_reference: string;
    criteria_reference: string;
    test_or_assessment_reference: string;
    observation_reference: string;
    evidence_reference: string;
    result_state: ValidationResult["result_state"];
    evaluator: string;
    timestamp: string;
    decision_reference?: string;
  };
}

/**
 * The Inngest implementation binding must provide real provider-side
 * operations. No synthetic observation is permitted.
 *
 * Keeping this port separate prevents Inngest-specific mechanics from
 * entering the provider-neutral RuntimeConformanceAdapter contract.
 */
export interface InngestRuntimeBinding {
  authorize(request: RuntimeAdapterRequest): Promise<InngestRuntimeSnapshot>;
  start(request: RuntimeAdapterRequest): Promise<InngestRuntimeSnapshot>;
  observe(executionId: string): Promise<InngestRuntimeSnapshot>;

  injectFailure?(
    executionId: string,
    scenario: unknown,
  ): Promise<InngestRuntimeSnapshot>;

  recover?(
    executionId: string,
    strategy: unknown,
  ): Promise<InngestRuntimeSnapshot>;

  repeat(request: RuntimeAdapterRequest): Promise<InngestRuntimeSnapshot>;
  correlateTrace?(executionId: string): Promise<InngestRuntimeSnapshot>;
  trace_correlation_supported?: boolean;
}

const BASE_CAPABILITIES: readonly RuntimeAdapterCapability[] = [
  "AUTHORIZATION",
  "STATE_OBSERVATION",
  "EVIDENCE_CAPTURE",
  "IDEMPOTENCY",
  "SECURITY_BOUNDARY",
];

function normalize(snapshot: InngestRuntimeSnapshot): RuntimeAdapterObservation {
  const execution: ExecutionRecord = {
    ...snapshot.execution,
    artifact_references: snapshot.execution.artifact_references ?? [],
    failure_recovery_references:
      snapshot.execution.failure_recovery_references ?? [],
    evidence_references: snapshot.evidence.map(
      (evidence) => evidence.evidence_id,
    ),
  };

  const evidence: EvidenceRecord[] = snapshot.evidence.map((item) => ({
    ...item,
  }));

  const validation: ValidationResult | undefined = snapshot.validation
    ? { ...snapshot.validation }
    : undefined;

  return { execution, evidence, validation };
}

export class InngestRuntimeAdapter implements RuntimeConformanceAdapter {
  readonly adapter_id = "AOS-INNGEST-RUNTIME-ADAPTER";
  readonly version = "0.1.0";
  readonly provider_neutral = true as const;
  readonly capabilities: readonly RuntimeAdapterCapability[];

  constructor(private readonly binding: InngestRuntimeBinding) {
    const capabilities = [...BASE_CAPABILITIES];
    if (binding.injectFailure) capabilities.push("FAILURE_INJECTION");
    if (binding.recover) capabilities.push("RECOVERY_RETRY");
    if (binding.trace_correlation_supported && binding.correlateTrace) {
      capabilities.push("TRACE_CORRELATION");
    }
    this.capabilities = capabilities;
  }

  async authorize(
    request: RuntimeAdapterRequest,
  ): Promise<RuntimeAdapterObservation> {
    return normalize(await this.binding.authorize(request));
  }

  async start(
    request: RuntimeAdapterRequest,
  ): Promise<RuntimeAdapterObservation> {
    return normalize(await this.binding.start(request));
  }

  async observe(executionId: string): Promise<RuntimeAdapterObservation> {
    return normalize(await this.binding.observe(executionId));
  }

  async injectFailure(
    executionId: string,
    scenario: unknown,
  ): Promise<RuntimeAdapterObservation> {
    if (!this.binding.injectFailure) {
      throw new Error("adapter_capability_unavailable:FAILURE_INJECTION");
    }
    return normalize(await this.binding.injectFailure(executionId, scenario));
  }

  async recover(
    executionId: string,
    strategy: unknown,
  ): Promise<RuntimeAdapterObservation> {
    if (!this.binding.recover) {
      throw new Error("adapter_capability_unavailable:RECOVERY_RETRY");
    }
    return normalize(await this.binding.recover(executionId, strategy));
  }

  async repeat(
    request: RuntimeAdapterRequest,
  ): Promise<RuntimeAdapterObservation> {
    return normalize(await this.binding.repeat(request));
  }

  async correlateTrace(
    executionId: string,
  ): Promise<RuntimeAdapterObservation> {
    if (!this.binding.correlateTrace) {
      throw new Error("adapter_capability_unavailable:TRACE_CORRELATION");
    }
    return normalize(await this.binding.correlateTrace(executionId));
  }
}
