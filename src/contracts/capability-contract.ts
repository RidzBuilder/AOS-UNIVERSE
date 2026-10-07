export interface CapabilityContract {
  capability_id: string;
  version: string;
  purpose: string;
  responsibility: string;
  inputs: unknown;
  outputs: unknown;
  state: unknown;
  dependencies: string[];
  permissions: string[];
  preconditions: string[];
  postconditions: string[];
  evidence_requirements: string[];
  failure_states: string[];
  recovery_requirements: string[];
  interface_reference: string;
  provider_neutrality: boolean;
  acceptance_criteria: string[];
}