import fs from "node:fs";

const files = {
  capability: fs.readFileSync("src/contracts/capability-contract.ts", "utf8"),
  interface: fs.readFileSync("src/contracts/interface-contract.ts", "utf8"),
  profile: fs.readFileSync("src/contracts/implementation-profile.ts", "utf8"),
  execution: fs.readFileSync("src/contracts/execution-record.ts", "utf8"),
  evidence: fs.readFileSync("src/contracts/evidence-record.ts", "utf8"),
  validation: fs.readFileSync("src/contracts/validation-result.ts", "utf8"),
};

const required = {
  capability: [
    "capability_id","version","purpose","responsibility","inputs","outputs","state",
    "dependencies","permissions","preconditions","postconditions","evidence_requirements",
    "failure_states","recovery_requirements","interface_reference","provider_neutrality",
    "acceptance_criteria"
  ],
  interface: [
    "interface_id","version","owner","request","response","event_semantics",
    "state_transitions","idempotency","dependency_references","permission_references",
    "evidence_references","compatibility_rules","error_recovery_semantics"
  ],
};

function checkFields(source, fields) {
  return fields.every((field) => new RegExp(`\\b${field}\\b`).test(source));
}

const results = [
  {
    test_id: "AOS-CONTRACT-001",
    family: "Contract conformance",
    result_state: checkFields(files.capability, required.capability) && checkFields(files.profile, [
      "implementation_profile_id","capability_reference","interface_reference","implementation_type",
      "adapter_reference","runtime_reference","provider_reference","configuration_boundary",
      "security_boundary","observability_requirements","evidence_requirements",
      "conformance_requirements","version"
    ]) ? "PASS" : "FAIL",
    observation: "Canonical CapabilityContract and ImplementationProfile required fields were structurally verified.",
    evidence_references: ["src/contracts/capability-contract.ts","src/contracts/implementation-profile.ts"],
    validation_reference: "R8-VAL-CONTRACT-001"
  },
  {
    test_id: "AOS-INTERFACE-001",
    family: "Interface conformance",
    result_state: checkFields(files.interface, required.interface) ? "PASS" : "FAIL",
    observation: "Canonical InterfaceContract required request, response, state, idempotency and recovery fields were structurally verified.",
    evidence_references: ["src/contracts/interface-contract.ts"],
    validation_reference: "R8-VAL-INTERFACE-001"
  },
  ...[
    ["AOS-GOVERNANCE-001","Governance/authorization conformance"],
    ["AOS-STATE-001","State-transition conformance"],
    ["AOS-EVIDENCE-001","Evidence/provenance conformance"],
    ["AOS-FAILURE-001","Failure-state conformance"],
    ["AOS-RECOVERY-001","Recovery/retry conformance"],
    ["AOS-IDEMPOTENCY-001","Idempotency conformance"],
    ["AOS-SUBSTITUTION-001","Provider substitution conformance"],
    ["AOS-SECURITY-001","Security-boundary conformance"],
    ["AOS-OBSERVABILITY-001","Observability/traceability conformance"],
    ["AOS-GOLDEN-PATH-001","Golden Path end-to-end conformance"],
  ].map(([test_id,family]) => ({
    test_id,
    family,
    result_state: "BLOCKED",
    observation: "Runtime/E2E execution adapter and family-specific evidence boundary are not established by the current R8 harness. No inference from basic runtime probe is permitted.",
    evidence_references: [],
    validation_reference: `R8-VAL-${test_id.replace("AOS-","")}`,
  })),
];

const summary = {
  gate: "R8",
  harness_id: "AOS-CONFORMANCE-HARNESS-v0.1",
  execution_id: "R8-CONFORMANCE-EXECUTION-001",
  results,
  counts: results.reduce((a,r) => ({...a,[r.result_state]:(a[r.result_state]??0)+1}), {}),
};

console.log(JSON.stringify(summary, null, 2));

if (results.filter((r) => r.result_state === "FAIL").length > 0) {
  process.exit(1);
}
