import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import redis from "@/lib/redis";
import { notifyClients } from "@/app/api/events/route";

// POST /api/upload — parse Excel/CSV file, load participants into Redis
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    // Detect if first row is a header (all values are strings and non-numeric)
    let startIdx = 0;
    const firstRow = rows[0];
    if (
      firstRow.every(
        (v) => typeof v === "string" && isNaN(Number(v.replace(/\s/g, "")))
      )
    ) {
      startIdx = 1;
    }

    const dataRows = rows.slice(startIdx).filter((r) => r.length > 0 && r[0] != null);
    if (dataRows.length === 0) {
      return NextResponse.json({ error: "No data rows found" }, { status: 400 });
    }

    // Determine column count (max across all rows)
    const maxCols = Math.max(...dataRows.map((r) => r.length));

    // Detect format
    type Participant = { id: string; name: string; tickets: number };
    const participants: Participant[] = [];

    if (maxCols === 1) {
      // Case 1: Only IDs
      for (const row of dataRows) {
        participants.push({ id: String(row[0]).trim(), name: "", tickets: 1 });
      }
    } else if (maxCols === 2) {
      // Case 2 or 3: check if Col B is numeric
      const colBValues = dataRows
        .map((r) => r[1])
        .filter((v) => v != null && String(v).trim() !== "");
      const allNumeric =
        colBValues.length > 0 &&
        colBValues.every((v) => !isNaN(Number(v)));

      if (allNumeric) {
        // Case 3: ID + Tickets
        for (const row of dataRows) {
          const tickets = row[1] != null ? Number(row[1]) : 1;
          participants.push({
            id: String(row[0]).trim(),
            name: "",
            tickets: Math.max(1, Math.floor(tickets)),
          });
        }
      } else {
        // Case 2: ID + Name
        for (const row of dataRows) {
          participants.push({
            id: String(row[0]).trim(),
            name: row[1] != null ? String(row[1]).trim() : "",
            tickets: 1,
          });
        }
      }
    } else {
      // Case 4: ID + Name + Tickets (3+ columns)
      for (const row of dataRows) {
        const tickets = row[2] != null && !isNaN(Number(row[2])) ? Number(row[2]) : 1;
        participants.push({
          id: String(row[0]).trim(),
          name: row[1] != null ? String(row[1]).trim() : "",
          tickets: Math.max(1, Math.floor(tickets)),
        });
      }
    }

    // Clear previous data and load into Redis using pipeline
    const pipeline = redis.pipeline();
    pipeline.del("tombola:weights", "tombola:names", "tombola:winners", "tombola:meta");

    let totalTickets = 0;
    for (const p of participants) {
      pipeline.hset("tombola:weights", p.id, String(p.tickets));
      if (p.name) {
        pipeline.hset("tombola:names", p.id, p.name);
      }
      totalTickets += p.tickets;
    }

    pipeline.hset("tombola:meta", {
      totalTickets: String(totalTickets),
      totalParticipants: String(participants.length),
      uploadedAt: new Date().toISOString(),
    });

    await pipeline.exec();

    notifyClients("upload", { participants: participants.length, totalTickets });

    return NextResponse.json({
      participants: participants.length,
      totalTickets,
      format: maxCols === 1 ? "ID" : maxCols === 2 ? "ID+Name/Tickets" : "ID+Name+Tickets",
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}
