export interface ImplementationProfile {
  implementation_profile_id: string;
  capability_reference: string;
  interface_reference: string;
  implementation_type: string;
  adapter_reference: string;
  runtime_reference: string;
  provider_reference: string;
  configuration_boundary: unknown;
  security_boundary: unknown;
  observability_requirements: string[];
  evidence_requirements: string[];
  conformance_requirements: string[];
  version: string;
}