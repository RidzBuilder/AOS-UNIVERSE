import fs from "node:fs";

const spinePath = "src/conformance/evidence-spine.ts";
const executorPath = "src/conformance/runtime-validation-executor.ts";

for (const path of [spinePath, executorPath]) {
  if (!fs.existsSync(path)) throw new Error(`missing_evidence_spine_file:${path}`);
}

const spine = fs.readFileSync(spinePath, "utf8");
const executor = fs.readFileSync(executorPath, "utf8");
const errors = [];

for (const token of [
  "ConformanceEvidenceSpine",
  "requirement_reference",
  "capability_reference",
  "test_reference",
  "observation_reference",
  "evidence_references",
  "validation_reference",
  "conformance_result_reference",
  "auditConformanceEvidenceSpines",
]) {
  if (!spine.includes(token)) errors.push(`missing_spine_token:${token}`);
}

for (const token of [
  "auditConformanceEvidenceSpines",
  "evidence_spine_audit",
]) {
  if (!executor.includes(token)) errors.push(`missing_runtime_enforcement:${token}`);
}

if (!spine.includes("pass_without_evidence")) {
  errors.push("missing_pass_without_evidence_guard");
}

const report = {
  gate: "N+4",
  validator: "AOS-CONFORMANCE-EVIDENCE-SPINE-VALIDATOR-v0.1",
  status: errors.length === 0 ? "PASS" : "FAIL",
  checks: [
    "provider_neutral_spine_contract",
    "runtime_executor_integration",
    "pass_requires_evidence_guard",
  ],
  errors,
};

if (errors.length) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));
