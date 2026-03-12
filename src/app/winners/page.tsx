"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSSE } from "@/lib/useSSE";

type Winner = { id: string; name?: string };

export default function WinnersPage() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);
  const [bgUrl, setBgUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/background")
      .then((r) => r.json())
      .then((d) => { if (d.url) setBgUrl(d.url); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const src = bgUrl || "/fondo_2.png";
    document.body.style.backgroundImage = `url("${src}")`;
    return () => { document.body.style.backgroundImage = ""; };
  }, [bgUrl]);

  const loadWinners = useCallback(() => {
    setLoading(true);
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => {
        setWinners(data.winners || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadWinners();
  }, [loadWinners]);

  // SSE: auto-refresh — wait for animation to finish on draws (11s)
  useSSE((event) => {
    if (event === "draw") {
      setTimeout(loadWinners, 12000);
    } else if (event === "reset") {
      loadWinners();
    }
  });

  return (
    <div style={{ minHeight: "100vh", padding: "40px 20px" }}>
      <div className="container" style={{ maxWidth: 700 }}>
        <h1
          style={{
            color: "#ffd700",
            textAlign: "center",
            marginBottom: 30,
            textShadow: "0 2px 8px rgba(0,0,0,0.6)",
          }}
        >
          Seleccionados
        </h1>

        {loading ? (
          <p style={{ color: "white", textAlign: "center", opacity: 0.5 }}>
            Cargando...
          </p>
        ) : winners.length > 0 ? (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "rgba(0,0,0,0.5)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid rgba(255,215,0,0.3)" }}>
                <th style={{ padding: 12, textAlign: "left", color: "#ffd700" }}>#</th>
                <th style={{ padding: 12, textAlign: "left", color: "#ffd700" }}>ID</th>
                <th style={{ padding: 12, textAlign: "left", color: "#ffd700" }}>Nombre</th>
              </tr>
            </thead>
            <tbody>
              {winners.map((w, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <td style={{ padding: 10, color: "white", opacity: 0.5 }}>{i + 1}</td>
                  <td style={{ padding: 10, color: "#ffd700", fontWeight: 600 }}>{w.id}</td>
                  <td style={{ padding: 10, color: "white" }}>{w.name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p
            style={{
              color: "white",
              textAlign: "center",
              opacity: 0.5,
              fontSize: 18,
            }}
          >
            No hay seleccionados aún
          </p>
        )}
      </div>
    </div>
  );
}
