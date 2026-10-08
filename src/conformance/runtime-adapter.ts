import type { ExecutionRecord } from "../contracts/execution-record";
import type { EvidenceRecord } from "../contracts/evidence-record";
import type { ValidationResult } from "../contracts/validation-result";

export type RuntimeAdapterCapability =
  | "AUTHORIZATION"
  | "STATE_OBSERVATION"
  | "EVIDENCE_CAPTURE"
  | "FAILURE_INJECTION"
  | "RECOVERY_RETRY"
  | "IDEMPOTENCY"
  | "SECURITY_BOUNDARY"
  | "TRACE_CORRELATION";

export interface RuntimeAdapterRequest {
  execution_id: string;
  request_reference: string;
  authorization_reference: string;
  workflow_reference: string;
  provider_reference: string;
  idempotency_key?: string;
  input: unknown;
}

export interface RuntimeAdapterObservation {
  execution: ExecutionRecord;
  evidence: EvidenceRecord[];
  validation?: ValidationResult;
}

/** Opaque provider-neutral handle for a dispatch whose runtime is observed later. */
export interface RuntimeDispatchHandle {
  dispatch_id: string;
  execution_id: string;
  phase: "DISPATCHED";
}

export interface RuntimeConformanceAdapter {
  adapter_id: string;
  version: string;
  provider_neutral: true;
  capabilities: readonly RuntimeAdapterCapability[];

  authorize(request: RuntimeAdapterRequest): Promise<RuntimeAdapterObservation>;
  start(request: RuntimeAdapterRequest): Promise<RuntimeAdapterObservation>;
  observe(execution_id: string): Promise<RuntimeAdapterObservation>;

  /** Split-phase failure dispatch. Dispatch and observation are intentionally separate. */
  dispatchFailure?(
    execution_id: string,
    scenario: unknown,
  ): Promise<RuntimeDispatchHandle>;

  /** Observe a previously dispatched operation from the control plane. */
  observeDispatch?(
    handle: RuntimeDispatchHandle,
  ): Promise<RuntimeAdapterObservation>;

  /** Split-phase recovery dispatch. */
  dispatchRecovery?(
    execution_id: string,
    strategy: unknown,
  ): Promise<RuntimeDispatchHandle>;

  injectFailure?(
    execution_id: string,
    scenario: unknown,
  ): Promise<RuntimeAdapterObservation>;

  recover?(
    execution_id: string,
    strategy: unknown,
  ): Promise<RuntimeAdapterObservation>;

  repeat(
    request: RuntimeAdapterRequest,
  ): Promise<RuntimeAdapterObservation>;

  correlateTrace(
    execution_id: string,
  ): Promise<RuntimeAdapterObservation>;
}
