# GATE N+4R — FAILURE/RECOVERY CONTINUATION ISOLATION

Status: BLOCKED / REMEDIATION REQUIRED

Date: 2026-10-08

## Scope

GATE N+4R isolates the failure/recovery continuation boundary after GATE N+4 Evidence Spine Enforcement. No new conformance family, Security, Observability, Provider 2, Golden Path, or Stage 18 was opened.

## Baseline

- Repository: RidzBuilder/AOS-UNIVERSE
- Branch: main
- Latest implementation commit: 47f87120530da7b32dbe437fcff47c5135aa5387
- Production deployment: dpl_E42ttQRNnf2pUqUgDXhwNPsWY1gf
- Deployment state: READY
- Inngest app: aos-universe
- Inngest environment: production
- Function count: 5
- Latest sync target: dpl_E42ttQRNnf2pUqUgDXhwNPsWY1gf endpoint
- Latest sync response: duplicate
- Controlled revalidation run: 01M4EC8NFNFPKVQBVJ7VN8GBR6
- Revalidation run was cancelled after deterministic failure at the failure-injection observation boundary.

## Observed path

The controlled parent reached:

1. state-observation — COMPLETED
2. evidence-observation — COMPLETED
3. controlled-conformance-event — COMPLETED
4. failure-injection observation — FAILED with:
   inngest_run_not_observed:01M4EC8QQFGG61P2ERY98CY8VC
5. Parent entered retry.
6. No aos-failure-probe run appeared for the application-generated failure event.

The production runtime log identified the exact failure boundary:
inngest_run_not_observed:01M4EC8QQFGG61P2ERY98CY8VC

The same pattern was observed after the initial N+4 enforcement runs.

## Differential control

An independent production event sent directly through the Inngest production control plane for the same trigger:

- event: aos/runtime.failure.probe
- event id: 01M4ECB5TGAKGPYFNZ49ECNVSZ
- resulting function run: 01M4ECB5Y2TC7JXAASYPKR9RGZ
- status: FAILED
- output: NonRetriableError from aos-failure-probe

Therefore:

- The aos-failure-probe function is registered.
- The trigger name is valid.
- The production environment can execute the failure probe.
- The failure probe itself is capable of producing the expected FAILED provider state.
- The unresolved boundary is the event delivery/observation path originating from the controlled parent execution.

## Targeted remediation executed

The controlled parent event dispatch was changed from direct inngest.send() inside the validation execution path to a durable step.sendEvent() callback.

Implementation changes:

- Runtime adapter accepts an injected durable event sender.
- Inngest binding uses the injected sender for failure and recovery probes.
- Controlled validation requires the durable event sender for the failure/recovery boundary.
- Parent function supplies step.sendEvent().
- No synthetic FAILED evidence was introduced.
- No AOS fundamental specification was changed.

Rationale: provider guidance requires event sends from inside an Inngest function to use step.sendEvent() rather than direct inngest.send() so delivery is recorded durably and is not replayed as an uncontrolled side effect.

## Revalidation result

The remediation deployment became READY and was synced against the production app.

Controlled revalidation still failed at the same semantic boundary:

- controlled-conformance-event completed as a durable step.
- The application-generated failure event did not produce an observable aos-failure-probe run.
- The parent subsequently failed on findRun().
- The parent run was cancelled in a controlled manner.

## Decision

GATE N+4R remains BLOCKED.

The durable event-dispatch remediation is retained because it corrects the execution-side durability semantics, but it is not accepted as sufficient evidence for conformance.

The remaining blocker is the application-originated event routing/observation boundary for the failure probe in the production environment. The direct production control-plane test proves that the downstream function and trigger are healthy, but does not prove that the application's event path reaches the same environment.

## GAP status

- GAP-RD-07: OPEN
- AOS-IDEMPOTENCY-001: BLOCKED
- Security: BLOCKED
- Observability / trace correlation: BLOCKED
- Provider substitution: BLOCKED
- Golden Path: NOT AUTHORIZED
- Stage 18: NOT ACCEPTED

## Hard stop

No progression beyond GATE N+4R is authorized until the application-originated failure event is observed in the intended production environment and the complete failure -> recovery -> continuation -> evidence-spine -> parent-finalization path is revalidated successfully.

Historical evidence is preserved.
