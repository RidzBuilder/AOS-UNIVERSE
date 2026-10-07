export interface ValidationResult {
  validation_id: string;
  requirement_reference: string;
  criteria_reference: string;
  test_or_assessment_reference: string;
  observation_reference: string;
  evidence_reference: string;
  result_state: "PASS" | "FAIL" | "BLOCKED" | "PARTIAL" | "REQUIRES_REVIEW" | "INVALIDATED" | "SUPERSEDED";
  evaluator: string;
  timestamp: string;
  decision_reference?: string;
}