# AOS UNIVERSE — Provider Registry Baseline v0.1

Status: SEMANTIC BASELINE / NO PROVIDER ACTIVATED

## Lifecycle

DISCOVERED → REGISTERED → MAPPED → COMPATIBILITY_CHECKED → VALIDATED → AUTHORIZED → ACTIVE → DEGRADED → SUSPENDED → DEPRECATED → RETIRED

## Current Entries

| Provider | Capability | Status |
|---|---|---|
| Inngest | Durable Execution | SELECTED / PREFERRED CANDIDATE |
| Vercel | Deployment | AVAILABLE / NOT BOUND |
| Supabase | Persistence | AVAILABLE / NOT BOUND |
| AppDeploy | Deployment | AVAILABLE / NOT BOUND |

## Invariants

- Provider ≠ Capability.
- Availability ≠ Validation.
- Validation ≠ Authorization.
- Authorization ≠ Activation.
- Provider substitution requires compatibility/conformance validation.
- No provider is ACTIVE merely because it appears in this registry.

## Inngest

Inngest remains the selected/preferred implementation direction for Durable Execution.

Current state:
- compatibility: NOT YET EVALUATED
- validation: NOT YET EXECUTED
- authorization: NOT AUTHORIZED
- activation: NOT AUTHORIZED

Fallback providers remain closed unless the Inngest path genuinely fails or is blocked after remediation/re-validation.
