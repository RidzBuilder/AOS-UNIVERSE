export interface ExecutionRecord {
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
  artifact_references: string[];
  evidence_references: string[];
  failure_recovery_references: string[];
  trace_reference?: string;
}