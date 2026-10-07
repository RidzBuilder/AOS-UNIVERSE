# AOS UNIVERSE — Concrete Component Registry v0.1

Status: BASELINE / REFERENCE IMPLEMENTATION PREPARATION

| Component | Responsibility | Boundary | Current status |
|---|---|---|---|
| Intent/Request Boundary | Receive governed request | Control/Operational | DEFINED |
| Authorization Boundary | Evaluate permission/authority | Governance | DEFINED |
| Orchestrator | Sequence authorized work | Orchestration | DEFINED |
| Capability Executor | Invoke capability through contract | Execution | DEFINED |
| Adapter Layer | Translate implementation/provider interface | Implementation | DEFINED |
| Runtime Boundary | Execute implementation | Runtime | DEFINED / BLOCKED |
| Provider Registry | Track provider lifecycle | Implementation | DEFINED |
| State Store | Persist required state | State | DEFINED / CANDIDATE |
| Artifact Store | Persist artifacts | Evidence | DEFINED / CANDIDATE |
| Evidence Store | Persist evidence/provenance | Evidence | DEFINED / CANDIDATE |
| Evaluation/Validation | Evaluate and validate outputs | Validation | DEFINED |
| Audit/Trace | Preserve traceability | Governance/Evidence | DEFINED |
| Evolution Controller | Govern changes | Evolution | DEFINED |
| Deployment Boundary | Govern release/deployment | Implementation | DEFINED / NOT AUTHORIZED |

## Boundary Rule

No component may silently absorb another component's constitutional responsibility.

## Provider Neutrality

Components reference capability and interface contracts first. Concrete providers are subordinate bindings.

## Runtime Note

The Runtime Boundary is defined but remains blocked for actual execution until an authorized executable runtime is available.
