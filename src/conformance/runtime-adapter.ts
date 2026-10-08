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

export interface RuntimeConformanceAdapter {
  adapter_id: string;
  version: string;
  provider_neutral: true;
  capabilities: readonly RuntimeAdapterCapability[];

  authorize(request: RuntimeAdapterRequest): Promise<RuntimeAdapterObservation>;
  start(request: RuntimeAdapterRequest): Promise<RuntimeAdapterObservation>;
  observe(execution_id: string): Promise<RuntimeAdapterObservation>;

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
