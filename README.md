# AOS UNIVERSE

AI R&D Operating System — Canonical Repository

## Repository State

This repository contains the AOS UNIVERSE reference implementation, canonical governance artifacts, executable conformance harnesses, and scoped runtime evidence. It is not an empty-repository bootstrap.

## Governing Position

AOS UNIVERSE is the universal, model-agnostic, tool-agnostic, platform-independent AI R&D Operating System.

The engineering toolchain is subordinate to the AOS implementation boundary and must not redefine AOS semantics.

## Current Lifecycle State

- Fundamental Specification v1.0 — FINAL / LOCKED
- Stage 15 — PASS
- Stage 16 — FINAL / PASS
- Stage 17 — PASS
- Stage 18 — NOT ACCEPTED / BLOCKED
- Inngest — selected/preferred durable-execution implementation candidate; scoped runtime evidence exists, but full provider/runtime conformance and activation are not established
- Conformance harness — structural checks exist; the R8 runner currently reports 2 structural PASS and 10 runtime/E2E BLOCKED
- GAP-RD-05 — OPEN; parent-controlled idempotency remains unproven
- GAP-RD-07 — OPEN in the canonical implementation status; historical result documents require chronology/evidence reconciliation

A deployment marked READY, an available provider, a registered function, a successful basic probe, or a scoped PASS does not establish full AOS conformance or authorize activation.

## Constitutional Execution Rule

Input → Requirement → Analysis → Design → Output → Validation → Evidence → Decision → Next Stage

PASS unlocks the next stage only when the applicable acceptance criteria and authorization gate are satisfied.
FAIL/BLOCKED requires remediation and re-validation.
No silent progression.

## Implementation Boundary

AOS Constitution
→ Universal Architecture
→ Capability / Contract
→ Interface
→ Implementation Profile
→ Adapter
→ Runtime
→ Provider
→ Execution
→ Evidence
→ Evaluation
→ Validation
→ Conformance
→ Acceptance
→ Activation

## Repository Integrity

- Repository writes must remain within approved AOS paths.
- Changes must be proposed through a branch and pull request; do not commit directly to main.
- CI must validate changed paths and scan changed content for cross-project contamination.
- Secrets must never be committed or printed in evidence.
- Branch protection and required-review settings are repository-administration controls and must be verified separately; a CODEOWNERS file alone does not enforce protection.

## Evidence and Status Discipline

Structural validation is not runtime conformance. Scoped runtime evidence is not family-wide acceptance. Artifact presence is not proof that the claimed behavior occurred. Unknown or incomplete results must not be promoted to PASS.

## Bootstrap History

The repository originated from a bootstrap baseline. That historical origin does not describe the current implementation state and must not be used as a claim that the repository is still empty.
