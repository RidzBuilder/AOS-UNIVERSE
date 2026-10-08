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
        note: "Use the protected control-plane query execute=1 to start a fresh canonical conformance run.",
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
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
      {
        gate: "GAP-RD-05",
        execution_mode: "EXTERNAL_CONTROL_PLANE",
        report,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        gate: "GAP-RD-05",
        execution_mode: "EXTERNAL_CONTROL_PLANE",
        result_state: "BLOCKED",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
