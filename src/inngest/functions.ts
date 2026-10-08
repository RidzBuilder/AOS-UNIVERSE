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

export const aosControlledConformanceObserver = inngest.createFunction(
  { id: "aos-controlled-conformance-observer", retries: 0, triggers: [{ event: "aos/conformance.observe.phase" }] },
  async ({ event, step, runId }) => {
    const eventId = typeof event.data?.failure_event_id === "string" ? event.data.failure_event_id : undefined;
    if (!eventId) throw new Error("failure_event_id_required");
    const observation = await step.run("observe-provider-run", async () => {
      const response = await fetch("https://api.inngest.com/v1/events/" + encodeURIComponent(eventId) + "/runs", {
        headers: { Authorization: "Bearer " + (process.env.INNGEST_SIGNING_KEY ?? "") },
      });
      if (!response.ok) throw new Error("observer_api_error:" + response.status);
      const deadline = Date.now() + 20_000;
      const terminal = new Set(["COMPLETED", "FAILED", "CANCELLED", "SKIPPED"]);
      while (Date.now() < deadline) {
        const response = await fetch(
          "https://api.inngest.com/v1/events/" + encodeURIComponent(eventId) + "/runs",
          {
            headers: {
              Authorization: "Bearer " + (process.env.INNGEST_SIGNING_KEY ?? ""),
              "x-inngest-env": process.env.INNGEST_ENV ?? "production",
            },
          },
        );
        if (!response.ok) throw new Error("observer_api_error:" + response.status);
        const body = (await response.json()) as {
          data?: Array<{
            id?: string;
            status?: string;
            function?: { id?: string; name?: string };
            trigger?: { eventIds?: string[]; eventName?: string };
          }>
        };
        const run = body.data?.[0];
        if (run?.id && terminal.has((run.status ?? "").toUpperCase())) {
          return {
            observer_state: run.status?.toUpperCase() ?? "UNKNOWN",
            failure_event_id: eventId,
            child_run_id: run.id,
            function_id: run.function?.id,
            function_name: run.function?.name,
            trigger_event_ids: run.trigger?.eventIds,
            trigger_event_name: run.trigger?.eventName,
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      return { observer_state: "PENDING", failure_event_id: eventId };
    });
    return { phase: "OBSERVE", observer_run_id: runId, observation };
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
  aosControlledConformanceDispatch,
  aosControlledConformanceObserver,
  aosFailureProbe,
  aosRecoveryContinuation,
  aosRecoveryProbe
];
