import { NextRequest, NextResponse } from "next/server";
import redis from "@/lib/redis";

export const dynamic = "force-dynamic";

const KEY = "tombola:config";

// GET /api/config — returns { winnerPosition, currentDraw }
export async function GET() {
  const config = await redis.hgetall(KEY);
  return NextResponse.json({
    winnerPosition: parseInt(config.winnerPosition || "1", 10),
    currentDraw: parseInt(config.currentDraw || "0", 10),
  });
}

// POST /api/config — set winnerPosition and optionally reset currentDraw
export async function POST(req: NextRequest) {
  try {
    const { winnerPosition } = await req.json();
    const pos = Math.max(1, Math.floor(Number(winnerPosition) || 1));
    await redis.hset(KEY, { winnerPosition: String(pos), currentDraw: "0" });
    return NextResponse.json({ winnerPosition: pos, currentDraw: 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
