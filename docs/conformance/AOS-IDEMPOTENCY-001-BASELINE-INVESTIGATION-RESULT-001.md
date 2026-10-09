# AOS UNIVERSE — AOS-IDEMPOTENCY-001 Baseline Investigation Result 001

**Decision:** BLOCKED — duplicate behavior is not yet attributable to the parent-controlled idempotency mechanism.
**AOS-IDEMPOTENCY-001:** BLOCKED / NOT PROVEN.
**Stage 18:** NOT ACCEPTED.
**GAP-RD-07:** remains CLOSED.
**Golden Path authorization:** remains CLOSED.

Date: 2026-10-09

## 1. Scope

This investigation establishes the current repository, deployment, provider, and duplicate-test baseline before implementation changes. It does not authorize downstream gates.

## 2. Baseline observations

- Repository: `RidzBuilder/AOS-UNIVERSE`, default branch `main`.
- Latest observed production deployment: `dpl_9enr3guPaBeKAaegZYmxL27DNyAk`, state `READY`, source commit `11b3fd29431ae119e99f653d66e8018425bff486`.
- Inngest app: `aos-universe`, environment `production`.
- Latest sync observed: `SUCCESS`, timestamp `2026-10-09T09:01:47.155941Z`.
- Five active canonical functions were observed.
- SSO protection remains enabled. No Vercel protection setting was changed.
- The canonical GAP-RD-05 R2 report remains the governing prior result: [GAP-RD-05 R2 result](https://github.com/RidzBuilder/AOS-UNIVERSE/blob/main/docs/conformance/GAP-RD-05-R2-CONTROL-PLANE-DISPATCH-ISOLATION-RESULT-001.md).

## 3. Controlled duplicate probe

A bounded probe was sent to `aos/runtime.probe` using two distinct event IDs and the same `event.data.idempotency_key`.

| Item | Observation |
|---|---|
| Shared idempotency key | `aos-idem001-baseline-key-20261009` |
| First provider event ID | `01M4G0V93V6TNYYHQVJQTA1VHN` |
| First function run ID | `01M4G0V982CR5H4F1AVMFJV809` |
| First run status | `COMPLETED` |
| First run effect reference | `aos-effect:aos-idem001-baseline-key-20261009` |
| Second provider event ID | `01M4G0VJ7NSWW8XWSJXPE7MG07` |
| Second event run observation | No run returned by the event-runs query at initial inspection or reinspection at `2026-10-09T09:47:19Z` |

The second event was accepted by the event-send API, but no corresponding function run was observed. This is a useful runtime observation, not a PASS.

## 4. Blocking findings

### GAP-IDEM-INV-001 — Provider configuration conflicts with isolated test

The live Inngest function configuration for `aos-runtime-probe` reports:

- `idempotency = event.data.idempotency_key` from the deployed function definition.
- `rateLimit.key = event.data.idempotency_key`, `limit = 1`, `period = 24h` from the live provider configuration.

The checked-in `src/inngest/functions.ts` declares the idempotency expression but does not declare this rate-limit configuration. This is a source/provider configuration drift and must be reconciled before interpreting a duplicate result.

Because both controls use the same field, the absence of a second run cannot establish whether function idempotency or rate limiting prevented execution.

### GAP-IDEM-INV-002 — Event identity is coupled to idempotency identity

The checked-in Inngest cloud binding's `start(request)` currently sets the provider event ID to `request.idempotency_key`. This couples event-delivery deduplication to function-level idempotency. A valid isolation test needs unique request/event identities while retaining the same function idempotency key.

### GAP-IDEM-INV-003 — Canonical harness does not yet execute the duplicate test

The checked-in `executeControlledRuntimeValidation` currently emits `AOS-IDEMPOTENCY-001 = BLOCKED` with no evidence. That is safer than an unsupported PASS, but it confirms the parent-controlled duplicate behavior is not implemented in the canonical harness.

### GAP-IDEM-INV-004 — Effect reference is not a persistent effect ledger

The runtime probe returns a deterministic `effect_reference` in its output. This is not a separately persisted business effect or a durable effect-count ledger. A future test must state precisely whether it proves one provider execution/logical effect emission or a separately persisted side effect; these claims must not be conflated.

## 5. Required remediation order

1. Reconcile the live Inngest function configuration with repository source and define an independent rate-limit dimension or remove the conflicting limit through a reviewed change.
2. Decouple provider event ID from `idempotency_key`, so duplicate requests can use distinct event IDs and a shared function idempotency key.
3. Implement the duplicate pair as a parent-controlled conformance test, with unique request/execution/event IDs and shared idempotency key.
4. Observe both event IDs, provider runs, terminal statuses, run outputs, and parent-to-child linkage. Bound the observation window and record its limits.
5. Count observed logical effect emissions from actual provider run outputs; do not describe the deterministic reference as a persistent external side effect.
6. Add canonical evidence and validation linkage, run evidence-spine audit, then re-run the deployed canonical path with fresh evidence.
7. Record a separate gate decision only after the acceptance criteria are met.

## 6. Gate decision

- `AOS-IDEMPOTENCY-001`: **BLOCKED / NOT PROVEN**.
- `GAP-RD-05`: prior scoped PASS remains unchanged.
- `GAP-RD-07`: CLOSED; no change.
- `Stage 18`: NOT ACCEPTED.
- `Golden Path authorization`: CLOSED.
- No code, provider configuration, deployment protection, or gate state was changed during this baseline investigation. Only two bounded probe events were sent.

## 7. Invariants

- Provider availability or event acceptance is not validation.
- A missing run is not sufficient evidence of idempotency when rate limiting is a competing explanation.
- A deterministic output reference is not a persistent effect ledger.
- Unknown or ambiguous behavior is not PASS.
- No downstream gate opens by implication.
