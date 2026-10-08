import { inngest } from "../../inngest/client";
import type {
  InngestRuntimeBinding,
  InngestRuntimeSnapshot,
} from "./inngest-runtime-adapter";
import type { RuntimeAdapterRequest } from "../runtime-adapter";

const API_BASE = "https://api.inngest.com";

type InngestRun = {
  run_id: string;
  run_started_at?: string;
  ended_at?: string;
  status: string;
  output?: unknown;
  event_id?: string;
};

type InngestRunsResponse = {
  data?: InngestRun[];
};

type InngestRunResponse = {
  data?: InngestRun;
};

function requireSigningKey(): string {
  const key = process.env.INNGEST_SIGNING_KEY;
  if (!key) {
    throw new Error("missing_provider_credential:INNGEST_SIGNING_KEY");
  }
  return key;
}

function envHeaders(): Record<string, string> {
  const env = process.env.INNGEST_ENV;
  return env ? { "x-inngest-env": env } : {};
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${requireSigningKey()}`,
      ...envHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(
      `inngest_api_error:${response.status}:${await response.text()}`,
    );
  }

  return (await response.json()) as T;
}

function snapshot(
  request: RuntimeAdapterRequest,
  run: InngestRun,
  evidenceId: string,
): InngestRuntimeSnapshot {
  const timestamp = new Date().toISOString();
  const executionState = run.status.toUpperCase();

  return {
    execution: {
      execution_id: run.run_id,
      request_reference: request.request_reference,
      authorization_reference: request.authorization_reference,
      workflow_reference: request.workflow_reference,
      runtime_reference: "inngest-cloud",
      provider_reference: "inngest",
      execution_state: executionState,
      timestamps: {
        observed_at: timestamp,
        ...(run.run_started_at
          ? { started_at: run.run_started_at }
          : {}),
        ...(run.ended_at ? { ended_at: run.ended_at } : {}),
      },
      attempts: 1,
      result_reference:
        run.output === undefined ? undefined : `run-output:${run.run_id}`,
      artifact_references: [],
      failure_recovery_references: [],
    },
    evidence: [
      {
        evidence_id: evidenceId,
        source_reference: `inngest:run:${run.run_id}`,
        observation: {
          run_id: run.run_id,
          status: run.status,
          event_id: run.event_id,
          output: run.output,
        },
        provenance: {
          provider: "inngest",
          api: "https://api.inngest.com/v1/runs",
        },
        timestamp,
        status: "OBSERVED",
      },
    ],
  };
}

async function findRun(eventId: string): Promise<InngestRun> {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    const response = await getJson<InngestRunsResponse>(
      `/v1/events/${encodeURIComponent(eventId)}/runs`,
    );
    const run = response.data?.[0];
    if (run) {
      const terminal = new Set(["COMPLETED", "FAILED", "CANCELLED", "SKIPPED"]);
      if (terminal.has(run.status.toUpperCase())) return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`inngest_run_not_observed:${eventId}`);
}

export const inngestCloudBinding: InngestRuntimeBinding = {
  trace_correlation_supported: false,
  async authorize(request) {
    if (!request.authorization_reference) {
      throw new Error("authorization_reference_required");
    }

    requireSigningKey();

    const run: InngestRun = {
      run_id: request.execution_id,
      status: "AUTHORIZED",
    };

    return snapshot(
      request,
      run,
      `aos-authorization-${request.execution_id}`,
    );
  },

  async start(request) {
    const eventId = request.idempotency_key ?? request.execution_id;

    const result = await inngest.send({
      id: eventId,
      name: request.workflow_reference,
      data: request.input,
    });

    const sentEventId = result.ids[0];
    if (!sentEventId) {
      throw new Error("inngest_event_send_missing_event_id");
    }

    const run = await findRun(sentEventId);
    return snapshot(
      request,
      run,
      `aos-runtime-observation-${run.run_id}`,
    );
  },

  async observe(executionId) {
    const response = await getJson<InngestRunResponse>(
      `/v1/runs/${encodeURIComponent(executionId)}`,
    );

    if (!response.data) {
      throw new Error(`inngest_run_not_found:${executionId}`);
    }

    const run = response.data;
    return snapshot(
      {
        execution_id: executionId,
        request_reference: `observed:${executionId}`,
        authorization_reference: `provider-observed:${executionId}`,
        workflow_reference: "unknown",
        provider_reference: "inngest",
        input: undefined,
      },
      run,
      `aos-runtime-observation-${run.run_id}`,
    );
  },

  async repeat(request) {
    return this.start({
      ...request,
      idempotency_key:
        request.idempotency_key ?? `${request.execution_id}:repeat`,
    });
  },

  async injectFailure(executionId, scenario) {
    const eventId = `aos-failure:${executionId}`;
    const result = await inngest.send({
      id: eventId,
      name: "aos/runtime.failure.probe",
      data: { execution_id: executionId, scenario },
    });
    const sentEventId = result.ids[0];
    if (!sentEventId) throw new Error("inngest_failure_event_send_missing_event_id");
    const run = await findRun(sentEventId);
    return snapshot({
      execution_id: executionId,
      request_reference: `failure-injection:${executionId}`,
      authorization_reference: `controlled-failure:${executionId}`,
      workflow_reference: "aos/runtime.failure.probe",
      provider_reference: "inngest",
      input: scenario,
    }, run, `aos-failure-${run.run_id}`);
  },

  async recover(executionId, strategy) {
    const eventId = `aos-recovery:${executionId}`;
    const result = await inngest.send({
      id: eventId,
      name: "aos/runtime.recovery.probe",
      data: { failed_execution_id: executionId, strategy },
    });
    const sentEventId = result.ids[0];
    if (!sentEventId) throw new Error("inngest_recovery_event_send_missing_event_id");
    const run = await findRun(sentEventId);
    return snapshot({
      execution_id: executionId,
      request_reference: `recovery:${executionId}`,
      authorization_reference: `controlled-recovery:${executionId}`,
      workflow_reference: "aos/runtime.recovery.probe",
      provider_reference: "inngest",
      input: strategy,
    }, run, `aos-recovery-${run.run_id}`);
  },
  async correlateTrace() {
    throw new Error(
      "trace_correlation_not_implemented_in_current_provider_binding",
    );
  },
};
