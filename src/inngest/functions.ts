import { inngest } from "./client";
import { executeControlledRuntimeValidation } from "../conformance/runtime-validation-executor";

export const aosRuntimeProbe = inngest.createFunction(
  { id: "aos-runtime-probe", triggers: [{ event: "aos/runtime.probe" }] },
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
      observation
    };
  }
);

export const aosControlledConformanceValidation = inngest.createFunction(
  {
    id: "aos-controlled-conformance-validation",
    triggers: [{ event: "aos/conformance.validate.controlled" }]
  },
  async ({ step }) => {
    return step.run("controlled-runtime-validation", async () => {
      return executeControlledRuntimeValidation(async (id, request) => {
        return step.invoke(id, {
          function: aosRuntimeProbe,
          data: request.input
        });
      });
    });
  }
);

export const functions = [
  aosRuntimeProbe,
  aosControlledConformanceValidation
];
