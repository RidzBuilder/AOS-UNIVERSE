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
      const eventKey = process.env.INNGEST_EVENT_KEY;
      if (!eventKey) throw new Error("missing_provider_credential:INNGEST_EVENT_KEY");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch(`https://inn.gs/e/${eventKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.INNGEST_ENV
              ? { "x-inngest-env": process.env.INNGEST_ENV }
              : {}),
          },
          body: JSON.stringify(event),
          signal: controller.signal,
        });

        const body = (await response.json()) as {
          ids?: string[];
          status?: number;
          error?: unknown;
        };

        if (!response.ok || body.status !== 200 || body.error) {
          throw new Error(
            `inngest_event_api_error:${response.status}:${JSON.stringify(body.error ?? body)}`,
          );
        }

        const eventId = body.ids?.[0];
        if (!eventId) throw new Error("controlled_conformance_event_id_missing");
        return eventId;
      } finally {
        clearTimeout(timeout);
      }
    };
    return executeControlledRuntimeValidation(async (id, request) => {
      return step.invoke(id, {
        function: aosRuntimeProbe,
        data: request.input
      });
    }, sendEvent);
  }
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
  aosFailureProbe,
  aosRecoveryContinuation,
  aosRecoveryProbe
];
