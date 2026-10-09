import { NextResponse } from "next/server";
import { executeControlledRuntimeValidation } from "../../../../conformance/runtime-validation-executor";
import { InngestRuntimeAdapter } from "../../../../conformance/adapters/inngest-runtime-adapter";
import { inngestCloudBinding } from "../../../../conformance/adapters/inngest-cloud-binding";

export const dynamic = "force-dynamic";

const adapter = new InngestRuntimeAdapter(inngestCloudBinding);

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("execute") !== "1") {
    return NextResponse.json(
      {
        route: "AOS controlled conformance control plane",
        execution: "not_started",
        requirement: "GAP-RD-05",
        note: "Execution requires the configured control-plane bearer token and a protected deployment boundary."
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  const configuredToken = process.env.AOS_CONTROL_PLANE_TOKEN;
  if (!configuredToken) {
    return NextResponse.json(
      { gate: "GAP-RD-05", result_state: "BLOCKED", reason: "control_plane_auth_not_configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== "Bearer " + configuredToken) {
    return NextResponse.json(
      { gate: "GAP-RD-05", result_state: "BLOCKED", reason: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store", "WWW-Authenticate": "Bearer" } },
    );
  }

  try {
    const report = await executeControlledRuntimeValidation(
      async (_id, runtimeRequest) => {
        const observation = await adapter.start(runtimeRequest);
        const providerObservation = observation.evidence[0]?.observation;
        return {
          run_id: observation.execution.execution_id,
          execution_state: observation.execution.execution_state,
          observation: providerObservation,
          attempt: observation.execution.attempts - 1,
        };
      },
    );

    return NextResponse.json(
      { gate: "GAP-RD-05", execution_mode: "EXTERNAL_CONTROL_PLANE", report },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        gate: "GAP-RD-05",
        execution_mode: "EXTERNAL_CONTROL_PLANE",
        result_state: "BLOCKED",
        error: "controlled_validation_failed"
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
