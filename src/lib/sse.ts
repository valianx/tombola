// SSE client management — shared across API routes

const clients = new Set<ReadableStreamDefaultController>();

export function addClient(controller: ReadableStreamDefaultController) {
  clients.add(controller);
}

export function removeClient(controller: ReadableStreamDefaultController) {
  clients.delete(controller);
}

export function notifyClients(event: string, data: any) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  Array.from(clients).forEach((controller) => {
    try {
      controller.enqueue(new TextEncoder().encode(msg));
    } catch {
      clients.delete(controller);
    }
  });
}
