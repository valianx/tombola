import { NextResponse } from "next/server";
import { addClient, removeClient } from "@/lib/sse";

export const dynamic = "force-dynamic";

// GET /api/events — SSE stream
export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      addClient(controller);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          removeClient(controller);
        }
      }, 15000);

      controller.enqueue(new TextEncoder().encode("event: connected\ndata: {}\n\n"));
    },
    cancel(controller) {
      removeClient(controller as any);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
