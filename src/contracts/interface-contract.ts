export interface InterfaceContract {
  interface_id: string;
  version: string;
  owner: string;
  request: unknown;
  response: unknown;
  event_semantics: unknown;
  state_transitions: unknown[];
  idempotency: unknown;
  dependency_references: string[];
  permission_references: string[];
  evidence_references: string[];
  compatibility_rules: string[];
  error_recovery_semantics: unknown;
}