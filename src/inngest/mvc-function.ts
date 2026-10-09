import { openai } from "@ai-sdk/openai";
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
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("missing_env:OPENAI_API_KEY");
    }

    const { request_id, input } = parsed.data;
    const startedAt = new Date().toISOString();

    const llmAndTool = await step.run("llm-call-and-tool-execution", async () => {
      const result = await generateText({
        model: openai("gpt-4o-mini"),
        prompt:
          "You are executing the AOS Minimal Viable Conformance probe. Call calculator exactly once to compute the arithmetic request in the user's input. Do not answer directly and do not request any other tool.",
        tools: {
          calculator: tool({
            description: "Perform one basic arithmetic operation on two numbers.",
            inputSchema: z.object({
              a: z.number().finite(),
              b: z.number().finite(),
              operation: z.enum(["add", "subtract", "multiply", "divide"]),
            }),
            execute: async ({ a, b, operation }) => {
              if (operation === "divide" && b === 0) {
                throw new Error("calculator_division_by_zero");
              }
              const value = operation === "add" ? a + b
                : operation === "subtract" ? a - b
                : operation === "multiply" ? a * b
                : a / b;
              return { a, b, operation, result: value };
            },
          }),
        },
        toolChoice: { type: "tool", toolName: "calculator" },
      });

      if (result.steps.length !== 1) {
        throw new Error("mvc_expected_exactly_one_llm_call");
      }
      if (result.toolResults.length !== 1) {
        throw new Error("mvc_expected_exactly_one_tool_call");
      }
      const calledTool = result.toolResults[0];
      if (calledTool.toolName !== "calculator") {
        throw new Error("mvc_unexpected_tool_executed");
      }

      return {
        provider: "openai",
        model: "gpt-4o-mini",
        llm_call_count: result.steps.length,
        tool_call_count: result.toolResults.length,
        tool_name: calledTool.toolName,
        tool_input: calledTool.input,
        tool_output: calledTool.output,
        finish_reason: result.finishReason,
        response_id: result.response.id,
        usage: result.totalUsage,
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
