# AOS UNIVERSE — GATE N+4R REVALIDATION RESULT 003

Status: PASS — SPLIT-PHASE OBSERVATION BOUNDARY VALIDATED

Date: 2026-10-08T19:31Z

## 1. Gate scope

This gate validates the previously blocked boundary:

Controlled Parent → Application-Originated Durable Event Dispatch → Provider Event Visibility → Provider Run Observation

The remediation changes orchestration only. No AOS Fundamental Specification or provider-neutral constitutional contract was changed.

## 2. Implementation

Implemented split-phase dispatch in src/inngest/functions.ts.

The controlled dispatch phase receives the conformance dispatch event, performs durable step.sendEvent() for the failure probe, returns the provider event ID, and completes its own run.

Provider observation is performed from the external control plane after the dispatch parent has completed. This is intentional: provider run observation from inside the Inngest function execution context was empirically unreliable even when the provider run was already terminal and externally observable.

Temporary internal observer functions were removed rather than retained as an unproven contract.

## 3. Fresh production evidence

### Phase A — Dispatch

execution_id: split-phase-final-muzxlclz
dispatch event: 01M4EFXJ5NNCKD0W70E1BXRTN8
dispatch run: 01M4EFXJ8GGDHXXW28VHQPBSZQ
dispatch status: COMPLETED
failure event: 01M4EFXJP0EGP58WXJKM37SS6X

### Phase B — Failure observation

Failure event: 01M4EFXJP0EGP58WXJKM37SS6X
Provider run: 01M4EFXK0BXFWMYAB1HGT21HAW
function: aos-failure-probe
status: FAILED
trigger: aos/runtime.failure.probe

The failure was observed externally after the dispatch parent had completed.

### Phase C — Recovery

Recovery event: 01M4EFXX8D8TH2FKM3VF6SNRAH
Recovery run: 01M4EFXXAXWYHBB0SMDNBNSWKM
status: COMPLETED
execution_state: RECOVERED
recovery trace: RECOVERING → RECOVERED
Continuation: 01M4EFXXMB1WHP8CV9MYHC6K9D

## 4. Gate conclusion

The original invalid synchronous assumption — dispatch followed by immediate provider run lookup inside the active parent — has been removed from the split-phase path.

The validated sequence is:
Phase A: Controlled dispatch → parent COMPLETED
Phase B: External control-plane observation → provider FAILED evidence
Phase C: Recovery dispatch → recovery COMPLETED / RECOVERED

Therefore the N+4R observation boundary is PASS.

## 5. Important boundary

This PASS does NOT mean all Stage 18 conformance is PASS.

The existing executeControlledRuntimeValidation() still contains the legacy immediate injectFailure → findRun orchestration and therefore must not be treated as the final Golden Path implementation.

## 6. Remaining gaps

Still open:
- GAP-RD-05 — Conformance Harness Execution / integration
- GAP-RD-07 — Unified Evidence Chain
- AOS-IDEMPOTENCY-001 — parent-controlled idempotency remains unproven
- Security validation
- Observability/trace correlation
- Provider substitution
- Golden Path authorization
- Stage 18 acceptance

## 7. Idempotency probe note

A duplicate external send experiment was attempted. The two tool calls returned distinct provider event IDs, so no idempotency PASS is inferred. Evidence is classified as INCONCLUSIVE, not PASS.

## 8. Governance

No downstream gate is opened solely because N+4R passed.

The next logical gate is integration of the split-phase orchestration into the canonical conformance harness and unified evidence model, followed by fresh revalidation.

Decision:
GATE N+4R = PASS
STAGE 18 = NOT ACCEPTED