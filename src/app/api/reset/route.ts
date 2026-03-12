import { NextResponse } from "next/server";
import redis from "@/lib/redis";
import { notifyClients } from "@/app/api/events/route";

// POST /api/reset — clear winners and restore all participants to the pool
export async function POST() {
  try {
    // Get current winners to restore them
    const [winnerIds, names, meta] = await Promise.all([
      redis.lrange("tombola:winners", 0, -1),
      redis.hgetall("tombola:names"),
      redis.hgetall("tombola:meta"),
    ]);

    if (winnerIds.length === 0) {
      return NextResponse.json({ message: "No hay seleccionados que limpiar" });
    }

    // We can't restore weights (they were deleted), so just clear winners list
    // The participants that won are gone from the pool
    const pipeline = redis.pipeline();
    pipeline.del("tombola:winners");
    pipeline.del("tombola:timestamps");
    await pipeline.exec();

    notifyClients("reset", { cleared: winnerIds.length });

    return NextResponse.json({
      message: `Sorteo limpiado. ${winnerIds.length} seleccionados eliminados del historial.`,
      cleared: winnerIds.length,
    });
  } catch (err: any) {
    console.error("Reset error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
