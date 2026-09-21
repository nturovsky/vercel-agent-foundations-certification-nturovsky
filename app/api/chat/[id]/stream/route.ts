/**
 * Resume-stream route for an agent chat.
 *
 * Re-attaches to a run by its ID so a refresh or dropped connection can pick up
 * exactly where it left off. `getRun()` looks it up and `getReadable()` returns
 * its stream from wherever the client left off.
 *
 * Workshop docs: https://agent-foundations-certification.vercel.app/docs/workflows
 */

import { createUIMessageStreamResponse } from "ai";
import { getRun } from "workflow/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const startIndexParam = searchParams.get("startIndex");
  const startIndex = startIndexParam ? parseInt(startIndexParam, 10) : undefined;

  const run = getRun(id);
  const readable = run.getReadable({ startIndex });
  const tailIndex = await readable.getTailIndex();

  return createUIMessageStreamResponse({
    stream: readable,
    headers: {
      "x-workflow-stream-tail-index": String(tailIndex),
    },
  });
}
