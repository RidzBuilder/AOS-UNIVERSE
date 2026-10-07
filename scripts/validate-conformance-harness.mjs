const fs = require("node:fs");

const manifestPath = "src/conformance/conformance-manifest.ts";
const harnessPath = "src/conformance/harness.ts";
const testPath = "src/conformance/conformance-test.ts";

for (const path of [manifestPath, harnessPath, testPath]) {
  if (!fs.existsSync(path)) {
    throw new Error(`missing_harness_file:${path}`);
  }
}

const manifest = fs.readFileSync(manifestPath, "utf8");
const harness = fs.readFileSync(harnessPath, "utf8");
const testContract = fs.readFileSync(testPath, "utf8");

const requiredFamilies = [
  "Contract conformance",
  "Interface conformance",
  "Governance/authorization conformance",
  "State-transition conformance",
  "Evidence/provenance conformance",
  "Failure-state conformance",
  "Recovery/retry conformance",
  "Idempotency conformance",
  "Provider substitution conformance",
  "Security-boundary conformance",
  "Observability/traceability conformance",
  "Golden Path end-to-end conformance",
];

const errors = [];

if ((manifest.match(/test_id:/g) ?? []).length !== 12) {
  errors.push("expected_exactly_12_test_definitions");
}

for (const family of requiredFamilies) {
  if (!manifest.includes(family)) errors.push(`missing_family:${family}`);
}

for (const token of [
  "preconditions",
  "inputs",
  "expected_behavior",
  "evidence_requirements",
  "validation_criteria",
  "provider_neutral",
]) {
  if (!manifest.includes(token)) errors.push(`missing_definition_field:${token}`);
}

for (const state of [
  "PASS",
  "FAIL",
  "BLOCKED",
  "PARTIAL",
  "REQUIRES_REVIEW",
  "INVALIDATED",
  "SUPERSEDED",
]) {
  if (!testContract.includes(`"${state}"`)) {
    errors.push(`missing_result_state:${state}`);
  }
}

if (!harness.includes("PASS requires evidence")) {
  errors.push("missing_no_false_pass_guard");
}

if (!harness.includes("provider_neutrality_violation")) {
  errors.push("missing_provider_neutrality_guard");
}

if (errors.length) {
  console.error(JSON.stringify({
    harness_id: "AOS-CONFORMANCE-HARNESS-v0.1",
    status: "FAIL",
    errors,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  harness_id: "AOS-CONFORMANCE-HARNESS-v0.1",
  status: "PASS",
  checked_test_families: 12,
  checks: [
    "all_required_families_present",
    "required_definition_fields_present",
    "result_semantics_present",
    "no_false_pass_guard_present",
    "provider_neutrality_guard_present",
  ],
}, null, 2));
