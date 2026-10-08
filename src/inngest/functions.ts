import { inngest } from "./client";
import { executeControlledRuntimeValidation } from "../conformance/runtime-validation-executor";

export const aosRuntimeProbe = inngest.createFunction(
  { id: "aos-runtime-probe", triggers: [{ event: "aos/runtime.probe" }] },
  async ({ event, step }) => {
    const observation = await step.run("runtime-observation", async () => ({
      execution_state: "RUNNING",
      event_name: "aos/runtime.probe",
      probe_id: event.data?.probe_id ?? "unknown"
    }));

    return {
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
      return executeControlledRuntimeValidation();
    });
  }
);

export const functions = [
  aosRuntimeProbe,
  aosControlledConformanceValidation
];
