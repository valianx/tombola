import { NextResponse } from "next/server";
import redis from "@/lib/redis";

// GET /api/stats — returns statistics + winner list
export async function GET() {
  try {
    const [meta, winnerIds, names, timestamps] = await Promise.all([
      redis.hgetall("tombola:meta"),
      redis.lrange("tombola:winners", 0, -1),
      redis.hgetall("tombola:names"),
      redis.hgetall("tombola:timestamps"),
    ]);

    const remainingParticipants = await redis.hlen("tombola:weights");

    const winners = winnerIds.map((id) => ({
      id,
      name: names[id] || undefined,
      timestamp: timestamps[id] || undefined,
    }));

    return NextResponse.json({
      totalParticipants: parseInt(meta.totalParticipants || "0", 10),
      remainingParticipants,
      totalTickets: parseInt(meta.totalTickets || "0", 10),
      uploadedAt: meta.uploadedAt || null,
      winners,
    });
  } catch (err: any) {
    console.error("Stats error:", err);
    return NextResponse.json(
      { error: err.message || "Stats failed" },
      { status: 500 }
    );
  }
}
