import { inngest } from "../../../inngest/client";

export const runtime = "nodejs";

const requestSchema = {
  isValid(value: unknown): value is { input: string; request_id?: string } {
    if (!value || typeof value !== "object") return false;
    const body = value as Record<string, unknown>;
    return (
      typeof body.input === "string" &&
      body.input.trim().length > 0 &&
      body.input.length <= 4000 &&
      (body.request_id === undefined ||
        (typeof body.request_id === "string" &&
          body.request_id.length > 0 &&
          body.request_id.length <= 120))
    );
  },
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!requestSchema.isValid(body)) {
    return Response.json(
      { error: "invalid_request", expected: { input: "non-empty string, max 4000 chars", request_id: "optional string, max 120 chars" } },
      { status: 400 },
    );
  }

  const requestId = body.request_id?.trim() || crypto.randomUUID();
  const queuedAt = new Date().toISOString();
  try {
    const result = await inngest.send({
      id: requestId,
      name: "aos/mvc.request",
      data: { request_id: requestId, input: body.input.trim(), queued_at: queuedAt },
    });
    return Response.json(
      { status: "QUEUED", request_id: requestId, event_ids: result.ids, queued_at: queuedAt },
      { status: 202 },
    );
  } catch {
    return Response.json({ error: "event_dispatch_failed", request_id: requestId }, { status: 502 });
  }
}
