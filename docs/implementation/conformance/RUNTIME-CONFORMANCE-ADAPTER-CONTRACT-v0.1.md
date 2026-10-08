# AOS UNIVERSE — Runtime Conformance Adapter Contract v0.1

## Status

DEFINED / IMPLEMENTATION BOUNDARY ESTABLISHED

This document defines the provider-neutral adapter boundary required to execute runtime conformance tests honestly. It does not execute conformance, declare a provider conformant, activate a provider, or authorize the Golden Path.

## Purpose

The adapter separates:

- AOS conformance semantics;
- runtime/provider-specific mechanics;
- evidence and validation capture.

A provider implementation may satisfy this boundary through an adapter, but adapter availability alone is not conformance evidence.

## Required capabilities

The adapter exposes explicit boundaries for:

1. authorization;
2. execution start;
3. state observation;
4. evidence capture;
5. optional controlled failure injection;
6. optional recovery/retry;
7. repeated execution for idempotency assessment;
8. trace correlation.

The capability list is explicit so the harness can distinguish:

`implemented capability` from `available evidence` from `conformance result`.

## Result boundary

An adapter observation returns:

- an ExecutionRecord;
- zero or more EvidenceRecord entries;
- an optional ValidationResult.

No PASS may be inferred from the existence of an adapter or an observation. The harness must evaluate the declared test's evidence requirements and validation criteria.

## Provider neutrality

The contract contains no Inngest-specific types, SDK calls, URLs, secrets, or provider-specific semantics.

The existing Inngest implementation remains an implementation candidate behind this boundary.

## Scope of this change

This is a contract/architecture implementation step only.

It does not:

- execute the ten previously blocked runtime/E2E families;
- execute Golden Path;
- declare Inngest conformant;
- add a second provider;
- change AOS Fundamental Specification v1.0;
- change Stage 15, 16, or 17 decisions.

## Decision gate

PASS means only:

`Runtime Conformance Adapter Contract = formally represented and provider-neutral.`

The next gate is implementation of an authorized adapter and its evidence boundary, followed by controlled validation.


## Implementation Boundary Update

The contract is now backed by an implementation split:

- provider-neutral contract: `src/conformance/runtime-adapter.ts`;
- Inngest adapter normalization: `src/conformance/adapters/inngest-runtime-adapter.ts`;
- Inngest Cloud binding: `src/conformance/adapters/inngest-cloud-binding.ts`;
- family capability mapping: `src/conformance/runtime-adapter-binding.ts`;
- build-time binding validation: `scripts/validate-runtime-adapter-binding.mjs`.

The Inngest Cloud binding uses real provider operations for event submission and run observation. It does not synthesize runtime results. Missing provider credentials or missing provider-side observations are hard errors.

Current binding scope:

| Capability | State |
|---|---|
| Authorization precondition | IMPLEMENTED |
| State observation | IMPLEMENTED |
| Evidence capture | IMPLEMENTED |
| Idempotency/repeat path | IMPLEMENTED |
| Security boundary | REPRESENTED / NOT CONFORMANCE-VALIDATED |
| Failure injection | IMPLEMENTED / CONTROLLED PROVIDER PROBE |
| Recovery/retry control | IMPLEMENTED / BOUNDED CONTINUATION PROBE |
| Trace correlation | NOT IMPLEMENTED |
| Provider substitution | NOT APPLICABLE TO SINGLE PROVIDER |
| Golden Path | NOT AUTHORIZED |

Failure/recovery provider mechanics are now implemented behind the adapter boundary and have passed a scoped controlled runtime validation. This does not promote Inngest to generally conformant, does not activate provider authorization beyond the current scoped validation, and does not authorize Golden Path.
