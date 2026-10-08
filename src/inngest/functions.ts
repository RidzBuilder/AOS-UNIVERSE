import { inngest } from "./client";
import { NonRetriableError } from "inngest";
import { executeControlledRuntimeValidation } from "../conformance/runtime-validation-executor";

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

export const aosControlledConformanceValidation = inngest.createFunction(
  {
    id: "aos-controlled-conformance-validation",
    triggers: [{ event: "aos/conformance.validate.controlled" }]
  },
  async ({ step }) => {
    const sendEvent = async (event: { id: string; name: string; data: Record<string, unknown> }) => {
      const stepId =
        event.name === "aos/runtime.failure.probe"
          ? "controlled-failure-event"
          : event.name === "aos/runtime.recovery.probe"
            ? "controlled-recovery-event"
            : "controlled-conformance-event";
      const result = await step.sendEvent(stepId, event);
      const eventId = result.ids[0];
      if (!eventId) throw new Error("controlled_conformance_event_id_missing");
      return eventId;
    };
    return executeControlledRuntimeValidation(async (id, request) => {
      return step.invoke(id, {
        function: aosRuntimeProbe,
        data: request.input
      });
    }, sendEvent);
  }
);

export const aosEventDispatchSink = inngest.createFunction(
  {
    id: "aos-event-dispatch-sink",
    retries: 0,
    triggers: [{ event: "aos/runtime.dispatch.sink" }]
  },
  async ({ event }) => ({
    observed: true,
    probe_id:
      typeof event.data?.probe_id === "string"
        ? event.data.probe_id
        : "unknown"
  }),
);

export const aosEventDispatchProbe = inngest.createFunction(
  {
    id: "aos-event-dispatch-probe",
    retries: 0,
    triggers: [{ event: "aos/runtime.event.dispatch.probe" }]
  },
  async ({ event, step, runId }) => {
    const probeId =
      typeof event.data?.probe_id === "string"
        ? event.data.probe_id
        : runId;
    const result = await step.sendEvent("dispatch-probe-event", {
      id: `aos-dispatch-probe:${probeId}`,
      name: "aos/runtime.dispatch.sink",
      data: { probe_id: probeId }
    });
    const eventId = result.ids[0];
    if (!eventId) throw new Error("dispatch_probe_event_id_missing");
    return { probe_id: probeId, event_id: eventId };
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
  aosRuntimeProbe,
  aosControlledConformanceValidation,
  aosEventDispatchProbe,
  aosEventDispatchSink,
  aosFailureProbe,
  aosRecoveryContinuation,
  aosRecoveryProbe
];
