"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSSE } from "@/lib/useSSE";

// TODO: proteger con Azure AD (Microsoft Entra ID)
// Pasos para implementar auth:
// 1. npm install next-auth @azure/msal-node
// 2. Configurar NextAuth con AzureADProvider en /api/auth/[...nextauth]
// 3. Envolver esta página con SessionProvider y useSession()
// 4. Variables de entorno: AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_TENANT_ID

type Winner = { id: string; name?: string };

type Stats = {
  totalParticipants: number;
  remainingParticipants: number;
  totalTickets: number;
  uploadedAt: string | null;
  winners: Winner[];
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState("");
  const [bgInput, setBgInput] = useState("");
  const [currentBg, setCurrentBg] = useState<string | null>(null);
  const [bgMsg, setBgMsg] = useState("");
  const [winnerPos, setWinnerPos] = useState(1);
  const [currentDraw, setCurrentDraw] = useState(0);
  const [configMsg, setConfigMsg] = useState("");

  const loadStats = useCallback(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const loadBackground = useCallback(() => {
    fetch("/api/background")
      .then((r) => r.json())
      .then((d) => {
        setCurrentBg(d.url);
        if (d.url) setBgInput(d.url);
      })
      .catch(() => {});
  }, []);

  const loadConfig = useCallback(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setWinnerPos(d.winnerPosition);
        setCurrentDraw(d.currentDraw);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadStats();
    loadBackground();
    loadConfig();
  }, [loadStats, loadBackground, loadConfig]);

  // SSE: auto-refresh stats when draws/uploads/resets happen
  useSSE((event) => {
    if (event === "draw" || event === "upload" || event === "reset") {
      loadStats();
      loadConfig();
    }
  });

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) {
        setUploadResult(`Error: ${data.error}`);
      } else {
        setUploadResult(
          `Cargados ${data.participants} participantes con ${data.totalTickets} tickets totales (formato: ${data.format})`
        );
        loadStats();
      }
    } catch {
      setUploadResult("Error de conexión");
    }
    setUploading(false);
  };

  const handleBgSave = async () => {
    setBgMsg("");
    try {
      const res = await fetch("/api/background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: bgInput.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setBgMsg(`Error: ${data.error}`);
      } else {
        setCurrentBg(data.url);
        setBgMsg(data.url ? "Fondo actualizado" : "Fondo restablecido al predeterminado");
      }
    } catch {
      setBgMsg("Error de conexión");
    }
  };

  const handleConfigSave = async () => {
    setConfigMsg("");
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerPosition: winnerPos }),
      });
      const data = await res.json();
      if (data.error) {
        setConfigMsg(`Error: ${data.error}`);
      } else {
        setWinnerPos(data.winnerPosition);
        setCurrentDraw(data.currentDraw);
        setConfigMsg("Configuración guardada");
      }
    } catch {
      setConfigMsg("Error de conexión");
    }
  };

  const [resetMsg, setResetMsg] = useState("");

  const handleResetSorteo = async () => {
    if (!confirm("¿Estás seguro? Se limpiará la lista de seleccionados.")) return;
    setResetMsg("");
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setResetMsg(`Error: ${data.error}`);
      } else {
        setResetMsg(data.message);
        loadStats();
      }
    } catch (err) {
      setResetMsg("Error de conexión");
    }
  };

  const handleExportWinners = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      const winners = data.winners || [];
      if (winners.length === 0) return;
      const header = "N°,ID,Nombre,Fecha";
      const rows = winners.map(
        (w: any, i: number) =>
          `${i + 1},${w.id},"${(w.name || "").replace(/"/g, '""')}",${w.timestamp ? new Date(w.timestamp).toLocaleString() : ""}`
      );
      const csv = [header, ...rows].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `seleccionados_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const handleBgReset = async () => {
    setBgMsg("");
    try {
      const res = await fetch("/api/background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "" }),
      });
      const data = await res.json();
      setCurrentBg(null);
      setBgInput("");
      setBgMsg("Fondo restablecido al predeterminado");
    } catch {
      setBgMsg("Error de conexión");
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#001C31",
        minHeight: "100vh",
        color: "white",
        padding: "40px 20px",
      }}
    >
      <div className="container" style={{ maxWidth: 800 }}>
        <h1 style={{ color: "#ffd700", marginBottom: 30 }}>
          Dashboard Tombola
        </h1>

        {/* Upload Section */}
        <div
          style={{
            background: "rgba(0,0,0,0.3)",
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h3>Subir Archivo de Participantes</h3>
          <p style={{ fontSize: 14, opacity: 0.7 }}>
            Acepta .xlsx, .xls, .csv — Detecta automáticamente el formato (ID /
            ID+Nombre / ID+Tickets / ID+Nombre+Tickets)
          </p>
          <form onSubmit={handleUpload} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label
              style={{
                backgroundColor: "#ffa800",
                color: "#102234",
                border: "none",
                borderRadius: 8,
                padding: "8px 20px",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-block",
              }}
            >
              {uploading ? "Subiendo..." : "Subir Archivo"}
              <input
                type="file"
                name="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    e.target.form?.requestSubmit();
                  }
                }}
              />
            </label>
            <span style={{ fontSize: 14, opacity: 0.5 }} id="fileName"></span>
          </form>
          {uploadResult && (
            <p style={{ marginTop: 12, color: "#7fff7f" }}>{uploadResult}</p>
          )}
        </div>

        {/* Background Image Section */}
        <div
          style={{
            background: "rgba(0,0,0,0.3)",
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h3>Imagen de Fondo</h3>
          <p style={{ fontSize: 14, opacity: 0.7 }}>
            Pega un enlace de imagen para cambiar el fondo. Déjalo vacío para usar el predeterminado (fondo_2.png).
          </p>
          {currentBg && (
            <p style={{ fontSize: 13, opacity: 0.5, wordBreak: "break-all" }}>
              Actual: {currentBg}
            </p>
          )}
          <div style={{ display: "flex", gap: 12 }}>
            <input
              type="text"
              value={bgInput}
              onChange={(e) => setBgInput(e.target.value)}
              placeholder="https://ejemplo.com/imagen.png"
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #555",
                backgroundColor: "#0a1929",
                color: "white",
              }}
            />
            <button
              onClick={handleBgSave}
              style={{
                backgroundColor: "#ffa800",
                color: "#102234",
                border: "none",
                borderRadius: 8,
                padding: "8px 20px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Guardar
            </button>
            <button
              onClick={handleBgReset}
              style={{
                backgroundColor: "transparent",
                color: "#ffa800",
                border: "1px solid #ffa800",
                borderRadius: 8,
                padding: "8px 16px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Restaurar Original
            </button>
          </div>
          {bgMsg && (
            <p style={{ marginTop: 8, color: "#7fff7f" }}>{bgMsg}</p>
          )}
        </div>

        {/* Stats Section */}
        <div
          style={{
            background: "rgba(0,0,0,0.3)",
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h3>Estadísticas</h3>
          {stats ? (
            <table
              style={{ width: "100%", borderCollapse: "collapse" }}
            >
              <tbody>
                <tr>
                  <td style={{ padding: 8, opacity: 0.7 }}>
                    Total participantes cargados
                  </td>
                  <td style={{ padding: 8, textAlign: "right" }}>
                    {stats.totalParticipants}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: 8, opacity: 0.7 }}>
                    Participantes restantes
                  </td>
                  <td style={{ padding: 8, textAlign: "right" }}>
                    {stats.remainingParticipants}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: 8, opacity: 0.7 }}>
                    Tickets restantes
                  </td>
                  <td style={{ padding: 8, textAlign: "right" }}>
                    {stats.totalTickets}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: 8, opacity: 0.7 }}>
                    Fecha de carga
                  </td>
                  <td style={{ padding: 8, textAlign: "right" }}>
                    {stats.uploadedAt
                      ? new Date(stats.uploadedAt).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p style={{ opacity: 0.5 }}>Cargando...</p>
          )}
        </div>

        {/* Winner Position Config */}
        <div
          style={{
            background: "rgba(0,0,0,0.3)",
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h3>Posición del Ganador</h3>
          <p style={{ fontSize: 14, opacity: 0.7 }}>
            Define en qué sorteo sale el ganador. Ej: si es 3, los primeros 2 son
            &quot;Al Agua&quot; y el 3ro es &quot;Ganador&quot;. Luego se reinicia el ciclo.
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input
              type="number"
              min={1}
              value={winnerPos}
              onChange={(e) => setWinnerPos(Math.max(1, parseInt(e.target.value) || 1))}
              style={{
                width: 80,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #555",
                backgroundColor: "#0a1929",
                color: "white",
                textAlign: "center",
                fontSize: 18,
              }}
            />
            <button
              onClick={handleConfigSave}
              style={{
                backgroundColor: "#ffa800",
                color: "#102234",
                border: "none",
                borderRadius: 8,
                padding: "8px 20px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Guardar
            </button>
            <span style={{ opacity: 0.5, fontSize: 14 }}>
              Sorteo actual: {currentDraw} / {winnerPos}
            </span>
          </div>
          {configMsg && (
            <p style={{ marginTop: 8, color: "#7fff7f" }}>{configMsg}</p>
          )}
        </div>

        {/* Winners actions + link */}
        <div
          style={{
            background: "rgba(0,0,0,0.3)",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h3>Seleccionados</h3>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button
              onClick={handleExportWinners}
              style={{
                backgroundColor: "#ffa800",
                color: "#102234",
                border: "none",
                borderRadius: 8,
                padding: "8px 20px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Exportar CSV
            </button>
            <button
              onClick={handleResetSorteo}
              style={{
                backgroundColor: "#cc3333",
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "8px 20px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Limpiar Sorteo
            </button>
          </div>
          {resetMsg && (
            <p style={{ color: "#7fff7f", marginBottom: 12 }}>{resetMsg}</p>
          )}
          {/* Winners table */}
          {stats && stats.winners.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
                  <th style={{ padding: 8, textAlign: "left" }}>#</th>
                  <th style={{ padding: 8, textAlign: "left" }}>ID</th>
                  <th style={{ padding: 8, textAlign: "left" }}>Nombre</th>
                </tr>
              </thead>
              <tbody>
                {stats.winners.map((w, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    <td style={{ padding: 8, opacity: 0.5 }}>{i + 1}</td>
                    <td style={{ padding: 8, color: "#ffd700" }}>{w.id}</td>
                    <td style={{ padding: 8 }}>{w.name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ opacity: 0.5, marginBottom: 16 }}>No hay seleccionados aún</p>
          )}
          <a
            href="/winners"
            style={{
              color: "#ffa800",
              fontSize: 16,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Ver pantalla de seleccionados &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
