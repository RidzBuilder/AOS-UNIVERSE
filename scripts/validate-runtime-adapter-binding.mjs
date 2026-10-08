import fs from "node:fs";

const adapter = fs.readFileSync(
  "src/conformance/adapters/inngest-runtime-adapter.ts",
  "utf8",
);
const binding = fs.readFileSync(
  "src/conformance/runtime-adapter-binding.ts",
  "utf8",
);
const contract = fs.readFileSync(
  "src/conformance/runtime-adapter.ts",
  "utf8",
);

const requiredCapabilities = [
  "AUTHORIZATION",
  "STATE_OBSERVATION",
  "EVIDENCE_CAPTURE",
  "FAILURE_INJECTION",
  "RECOVERY_RETRY",
  "IDEMPOTENCY",
  "SECURITY_BOUNDARY",
  "TRACE_CORRELATION",
];

const requiredFamilies = [
  "AOS-GOVERNANCE-001",
  "AOS-STATE-001",
  "AOS-EVIDENCE-001",
  "AOS-FAILURE-001",
  "AOS-RECOVERY-001",
  "AOS-IDEMPOTENCY-001",
  "AOS-SUBSTITUTION-001",
  "AOS-SECURITY-001",
  "AOS-OBSERVABILITY-001",
  "AOS-GOLDEN-PATH-001",
];

const errors = [];

if (!adapter.includes("implements RuntimeConformanceAdapter")) {
  errors.push("adapter_does_not_implement_runtime_conformance_contract");
}

for (const capability of requiredCapabilities) {
  if (!adapter.includes(capability) && !contract.includes(capability)) {
    errors.push(`missing_adapter_capability:${capability}`);
  }
}

for (const family of requiredFamilies) {
  if (!binding.includes(family)) {
    errors.push(`missing_family_binding:${family}`);
  }
}

for (const forbidden of [
  "secret",
  "process.env",
  "apiKey",
  "signingKey",
]) {
  if (contract.includes(forbidden)) {
    errors.push(`provider_secret_or_runtime_detail_leaked_into_contract:${forbidden}`);
  }
}

if (!binding.includes("REQUIRES_SECOND_PROVIDER")) {
  errors.push("missing_substitution_gate");
}

if (!binding.includes("REQUIRES_GOLDEN_PATH_AUTHORIZATION")) {
  errors.push("missing_golden_path_authorization_gate");
}

if (errors.length > 0) {
  console.error(
    JSON.stringify(
      {
        gate: "RUNTIME-CONFORMANCE-ADAPTER-BINDING",
        status: "FAIL",
        errors,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      gate: "RUNTIME-CONFORMANCE-ADAPTER-BINDING",
      status: "PASS",
      checked_capabilities: requiredCapabilities.length,
      checked_runtime_families: requiredFamilies.length,
      checks: [
        "provider-neutral_contract_boundary_preserved",
        "runtime_adapter_contract_implemented",
        "family_capability_mapping_present",
        "substitution_requires_second_provider",
        "golden_path_requires_separate_authorization",
      ],
    },
    null,
    2,
  ),
);
