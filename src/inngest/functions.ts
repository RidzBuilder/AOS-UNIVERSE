import { inngest } from "./client";

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

export const functions = [aosRuntimeProbe];