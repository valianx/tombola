import { NextResponse } from "next/server";

// Store connected clients
const clients = new Set<ReadableStreamDefaultController>();

export function notifyClients(event: string, data: any) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const controller of clients) {
    try {
      controller.enqueue(new TextEncoder().encode(msg));
    } catch {
      clients.delete(controller);
    }
  }
}

// GET /api/events — SSE stream
export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      clients.add(controller);
      // Send heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          clients.delete(controller);
        }
      }, 15000);

      // Cleanup on close
      controller.enqueue(new TextEncoder().encode("event: connected\ndata: {}\n\n"));
    },
    cancel(controller) {
      clients.delete(controller as any);
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

export { clients };
