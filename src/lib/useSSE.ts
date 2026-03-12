"use client";

import { useEffect, useRef } from "react";

type SSEHandler = (event: string, data: any) => void;

export function useSSE(onEvent: SSEHandler) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      es = new EventSource("/api/events");

      es.addEventListener("draw", (e) => {
        handlerRef.current("draw", JSON.parse(e.data));
      });

      es.addEventListener("upload", (e) => {
        handlerRef.current("upload", JSON.parse(e.data));
      });

      es.addEventListener("reset", (e) => {
        handlerRef.current("reset", JSON.parse(e.data));
      });

      es.onerror = () => {
        es?.close();
        retryTimeout = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      es?.close();
      clearTimeout(retryTimeout);
    };
  }, []);
}
