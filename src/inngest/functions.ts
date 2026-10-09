import { inngest } from "./client";
import { NonRetriableError } from "inngest";
import { aosMvcGoldenPath } from "./mvc-function";

export const aosRuntimeProbe = inngest.createFunction(
  {
    id: "aos-runtime-probe",
    idempotency: "event.data.idempotency_key",
    triggers: [{ event: "aos/runtime.probe" }]
  },
  async ({ event, step, runId, attempt }) => {
    const observation = await step.run("runtime-observation", async () => ({
      execution_state: "RUNNING",
      event_name: "aos/runtime.probe",
      probe_id: event.data?.probe_id ?? "unknown"
    }));

    return {
      run_id: runId,
      attempt,
      execution_state: "COMPLETED",
      observation: {
        ...observation,
        state_trace: ["RUNNING", "COMPLETED"],
        effect_reference:
          typeof event.data?.idempotency_key === "string"
            ? `aos-effect:${event.data.idempotency_key}`
            : undefined
      }
    };
  }
);

export const aosControlledConformanceDispatch = inngest.createFunction(
  { id: "aos-controlled-conformance-dispatch", retries: 0, triggers: [{ event: "aos/conformance.dispatch.phase" }] },
  async ({ event, step, runId }) => {
    const executionId = typeof event.data?.execution_id === "string" ? event.data.execution_id : runId;
    const failureEventId = `aos-failure:${executionId}`;
    const failureDispatch = await step.sendEvent("dispatch-failure-event", {
      id: failureEventId,
      name: "aos/runtime.failure.probe",
      data: { execution_id: executionId, scenario: { mode: "CONTROLLED_NON_RETRIABLE_FAILURE", reason: "AOS split-phase failure conformance probe" } },
    });
    return { phase: "DISPATCH", run_id: runId, execution_id: executionId, failure_event_id: failureDispatch.ids[0] ?? failureEventId, dispatch_state: "DISPATCHED" };
  },
);

export const aosFailureProbe = inngest.createFunction(
  {
    id: "aos-failure-probe",
    retries: 1,
    triggers: [{ event: "aos/runtime.failure.probe" }]
  },
  async ({ event }) => {
    const executionId =
      typeof event.data?.execution_id === "string"
        ? event.data.execution_id
        : "unknown";
    throw new NonRetriableError(
      `AOS controlled failure injection: ${executionId}`,
    );
  },
);

export const aosRecoveryContinuation = inngest.createFunction(
  {
    id: "aos-recovery-continuation",
    retries: 1,
    triggers: [{ event: "aos/runtime.recovery.continue" }]
  },
  async ({ event, step, runId }) => {
    const failedExecutionId =
      typeof event.data?.failed_execution_id === "string"
        ? event.data.failed_execution_id
        : "unknown";

    return step.run("recovery-continuation", async () => ({
      recovery_state: "RECOVERED",
      failed_execution_id: failedExecutionId,
      recovery_run_id: runId,
      recovery_trace: ["RECOVERING", "RECOVERED"],
    }));
  },
);

export const aosRecoveryProbe = inngest.createFunction(
  {
    id: "aos-recovery-probe",
    retries: 1,
    triggers: [{ event: "aos/runtime.recovery.probe" }]
  },
  async ({ event, step, runId }) => {
    const failedExecutionId =
      typeof event.data?.failed_execution_id === "string"
        ? event.data.failed_execution_id
        : "unknown";

    const continuation = await step.invoke("recovery-continuation", {
      function: aosRecoveryContinuation,
      data: {
        failed_execution_id: failedExecutionId,
      },
    });

    return {
      run_id: runId,
      execution_state: "RECOVERED",
      observation: {
        failed_execution_id: failedExecutionId,
        recovery_run_id: runId,
        continuation,
        recovery_trace: ["RECOVERING", "RECOVERED"],
      },
    };
  },
);

export const functions = [
  aosMvcGoldenPath,
  aosRuntimeProbe,
  aosControlledConformanceDispatch,
  aosFailureProbe,
  aosRecoveryContinuation,
  aosRecoveryProbe
];
