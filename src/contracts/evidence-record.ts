export interface EvidenceRecord {
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
}