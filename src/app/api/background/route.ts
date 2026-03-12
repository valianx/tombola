import { NextRequest, NextResponse } from "next/server";
import redis from "@/lib/redis";

export const dynamic = "force-dynamic";

const REDIS_KEY = "tombola:background";

// GET /api/background — returns current background image URL
export async function GET() {
  const url = await redis.get(REDIS_KEY);
  return NextResponse.json({ url: url || null });
}

// POST /api/background — set a new background image URL (or clear it)
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || String(url).trim() === "") {
      await redis.del(REDIS_KEY);
      return NextResponse.json({ url: null, message: "Background reset to default" });
    }

    const trimmed = String(url).trim();
    await redis.set(REDIS_KEY, trimmed);
    return NextResponse.json({ url: trimmed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
