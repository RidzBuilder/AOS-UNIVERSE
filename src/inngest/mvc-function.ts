import { groq } from "@ai-sdk/groq";
import { generateText, tool } from "ai";
import { z } from "zod";
import { inngest } from "./client";

const inputSchema = z.object({
  request_id: z.string().min(1).max(120),
  input: z.string().trim().min(1).max(4000),
});

export const aosMvcGoldenPath = inngest.createFunction(
  {
    id: "aos-mvc-golden-path",
    retries: 0,
    triggers: [{ event: "aos/mvc.request" }],
  },
  async ({ event, step, runId, attempt }) => {
    const parsed = inputSchema.safeParse(event.data);
    if (!parsed.success) {
      throw new Error("invalid_mvc_request");
    }
    if (!process.env.GROQ_API_KEY) {
      throw new Error("missing_env:GROQ_API_KEY");
    }

    const { request_id, input } = parsed.data;
    const startedAt = new Date().toISOString();

    const llmAndTool = await step.run("llm-call-and-tool-execution", async () => {
      const result = await generateText({
        model: groq(process.env.AOS_GROQ_MODEL || "llama-3.3-70b-versatile"),
        prompt:
          "You are executing the AOS Minimal Viable Conformance probe. Call inspect_text exactly once with the user's input. Do not answer directly and do not request any other tool.",
        tools: {
          inspect_text: tool({
            description:
              "Inspect the supplied text and return deterministic counts and a short preview.",
            inputSchema: z.object({
              text: z.string().min(1).max(4000),
            }),
            execute: async ({ text }) => ({
              character_count: text.length,
              word_count: text.trim().split(/\s+/).filter(Boolean).length,
              preview: text.slice(0, 120),
            }),
          }),
        },
        toolChoice: { type: "tool", toolName: "inspect_text" },
      });

      const calledTool = result.toolResults.find(
        (item) => item.toolName === "inspect_text",
      );
      if (!calledTool) {
        throw new Error("mvc_tool_not_executed");
      }

      return {
        provider: "groq",
        model: process.env.AOS_GROQ_MODEL || "llama-3.3-70b-versatile",
        llm_call_count: 1,
        tool_call_count: 1,
        tool_name: calledTool.toolName,
        tool_input: calledTool.input,
        tool_output: calledTool.output,
        finish_reason: result.finishReason,
        response_id: result.response.id,
      };
    });

    const completedAt = new Date().toISOString();
    return {
      mvc_version: "1.0",
      request_id,
      execution_id: runId,
      attempt,
      state: "COMPLETED",
      input,
      output: llmAndTool.tool_output,
      execution: llmAndTool,
      trace: {
        provider: "inngest",
        run_id: runId,
        trace_reference: `inngest:run:${runId}`,
        started_at: startedAt,
        completed_at: completedAt,
        event_id: event.id,
      },
    };
  },
);
