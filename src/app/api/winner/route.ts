import { NextResponse } from "next/server";
import redis from "@/lib/redis";
import { notifyClients } from "@/app/api/events/route";

// POST /api/winner — weighted random draw
// Returns { id, name?, isWinner, drawNumber, winnerPosition }
export async function POST() {
  try {
    const weights = await redis.hgetall("tombola:weights");
    const entries = Object.entries(weights);

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "No participants remaining" },
        { status: 404 }
      );
    }

    // Read config
    const config = await redis.hgetall("tombola:config");
    const winnerPosition = parseInt(config.winnerPosition || "1", 10);
    const currentDraw = parseInt(config.currentDraw || "0", 10);
    const newDraw = currentDraw + 1;
    const isWinner = newDraw >= winnerPosition;

    // Calculate total and pick random
    let totalTickets = 0;
    const parsed: { id: string; tickets: number }[] = [];
    for (const [id, t] of entries) {
      const tickets = parseInt(t, 10);
      parsed.push({ id, tickets });
      totalTickets += tickets;
    }

    const r = Math.floor(Math.random() * totalTickets);
    let cumulative = 0;
    let winnerId = parsed[0].id;
    let winnerTickets = parsed[0].tickets;

    for (const p of parsed) {
      cumulative += p.tickets;
      if (cumulative > r) {
        winnerId = p.id;
        winnerTickets = p.tickets;
        break;
      }
    }

    // Remove from pool, get name, record
    const pipeline = redis.pipeline();
    pipeline.hdel("tombola:weights", winnerId);
    pipeline.hget("tombola:names", winnerId);
    pipeline.lpush("tombola:winners", winnerId);
    pipeline.hset("tombola:timestamps", winnerId, new Date().toISOString());
    pipeline.hincrby("tombola:meta", "totalTickets", -winnerTickets);

    // Update draw counter: reset to 0 if this was the winner, otherwise increment
    if (isWinner) {
      pipeline.hset("tombola:config", "currentDraw", "0");
    } else {
      pipeline.hset("tombola:config", "currentDraw", String(newDraw));
    }

    const results = await pipeline.exec();
    const name = results?.[1]?.[1] as string | null;

    const result = {
      id: winnerId,
      name: name || undefined,
      isWinner,
      drawNumber: newDraw,
      winnerPosition,
    };

    // Notify all connected tabs
    notifyClients("draw", result);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Winner error:", err);
    return NextResponse.json(
      { error: err.message || "Draw failed" },
      { status: 500 }
    );
  }
}
