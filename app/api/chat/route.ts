/**
 * Chat API route.
 *
 * Each request starts the `chatFlow` workflow (a durable `DurableAgent` run)
 * instead of calling the agent directly. `start()` kicks off the run and hands
 * back its readable stream, which we return to the client exactly as before.
 * The run ID is returned in a header so the client can re-attach to the run
 * after a refresh or a dropped connection.
 *
 * Workshop docs: https://agent-foundations-certification.vercel.app/docs/workflows
 */

import { chatFlow } from "@/lib/workflows/chat-flow";
import type { UIMessage } from "ai";
import { createUIMessageStreamResponse } from "ai";
import { start } from "workflow/api";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const run = await start(chatFlow, [messages]);
  return createUIMessageStreamResponse({
    stream: run.readable,
    headers: {
      "x-workflow-run-id": run.runId,
    },
  });
}
