"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useSSE } from "@/lib/useSSE";

export default function Tombola() {
  const [loading, setLoading] = useState(false);
  const [nro1, setNro1] = useState<string | null>(null);
  const [nro2, setNro2] = useState<string | null>(null);
  const [nro3, setNro3] = useState<string | null>(null);
  const [nro4, setNro4] = useState<string | null>(null);
  const [nro5, setNro5] = useState<string | null>(null);
  const [nro6, setNro6] = useState<string | null>(null);
  const [nro7, setNro7] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [winnerName, setWinnerName] = useState("");
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const confettiRef = useRef<typeof import("canvas-confetti").default | null>(null);
  const isDrawing = useRef(false);

  // SSE: other tabs see the draw animation in real-time
  useSSE((event, data) => {
    if (event === "draw" && !isDrawing.current) {
      clearDigits();
      const padded = String(data.id).trim().padStart(7, "0");
      if (data.isWinner) {
        revealDigits(padded, "¡Cliente Ganador!", true, data.name);
      } else {
        revealDigits(padded, "Cliente Al Agua", false);
      }
    }
  });

  useEffect(() => {
    // Dynamic import to avoid SSR issues
    import("canvas-confetti").then((mod) => {
      confettiRef.current = mod.default;
    });
  }, []);

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

  const launchConfetti = useCallback(() => {
    const fire = confettiRef.current;
    if (!fire) return;

    const duration = 4000;
    const end = Date.now() + duration;

    // Explosión central
    fire({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.5 },
      colors: ["#ffd700", "#ffa800", "#ff6600", "#ffffff", "#00bfff", "#ff00ff"],
    });

    // Serpentinas continuas desde ambos lados
    const frame = () => {
      fire({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ["#ffd700", "#ffa800", "#ff6600", "#ffffff", "#00bfff"],
      });
      fire({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ["#ffd700", "#ffa800", "#ff6600", "#ffffff", "#00bfff"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  const clearDigits = () => {
    setNro1(null);
    setNro2(null);
    setNro3(null);
    setNro4(null);
    setNro5(null);
    setNro6(null);
    setNro7(null);
    setMessage("");
    setWinnerName("");
    setLoading(true);
  };

  const revealDigits = (
    padded: string,
    endMessage: string,
    showConfetti: boolean,
    name?: string
  ) => {
    setTimeout(() => setNro1(padded[0]), 1000);
    setTimeout(() => setNro2(padded[1]), 2000);
    setTimeout(() => setNro3(padded[2]), 3000);
    setTimeout(() => setNro4(padded[3]), 5000);
    setTimeout(() => setNro5(padded[4]), 7000);
    setTimeout(() => setNro6(padded[5]), 9000);
    setTimeout(() => {
      setNro7(padded[6]);
      setMessage(endMessage);
      if (name) setWinnerName(name);
      if (showConfetti) launchConfetti();
      setLoading(false);
    }, 11000);
  };

  const draw = () => {
    isDrawing.current = true;
    clearDigits();
    fetch("/api/winner", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setMessage(data.error);
          setLoading(false);
          isDrawing.current = false;
          return;
        }
        const padded = String(data.id).trim().padStart(7, "0");
        if (data.isWinner) {
          revealDigits(padded, "¡Cliente Ganador!", true, data.name);
        } else {
          revealDigits(padded, "Cliente Al Agua", false);
        }
        // Reset flag after animation completes
        setTimeout(() => { isDrawing.current = false; }, 12000);
      })
      .catch(() => {
        setMessage("Error al sortear");
        setLoading(false);
        isDrawing.current = false;
      });
  };

  const loadingSpinner = (
    <Image alt="" src="/loading.gif" width={50} height={50} unoptimized />
  );

  return (
    <div className="container caja_numeros text-center">
      <div className="row justify-content-center mt-5">
        {[nro1, nro2, nro3, nro4, nro5, nro6, nro7].map((digit, i) => (
          <div className="col" key={i}>
            <div className="box_numbre_id">
              {loading && !digit ? loadingSpinner : digit}
            </div>
          </div>
        ))}
      </div>

      <div className="container text-center mt-5">
        <div className="row">
          <div id="message">{message}</div>
          {winnerName && <div id="winnerName">{winnerName}</div>}
        </div>

        <div className="row">
          <div className="col">
            <button
              type="button"
              id="BtnGanador"
              className="botones"
              onClick={draw}
              disabled={loading}
            >
              SORTEAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
