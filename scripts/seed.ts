// Usage: npx tsx scripts/seed.ts
// Loads 20 test participants into Redis

import Redis from "ioredis";

const url = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new Redis(url);

const participants = [
  { id: "1001234", name: "Juan Pérez", tickets: 150 },
  { id: "1005678", name: "María López", tickets: 80 },
  { id: "1009012", name: "Carlos García", tickets: 200 },
  { id: "1003456", name: "Ana Martínez", tickets: 50 },
  { id: "1007890", name: "Pedro Rodríguez", tickets: 300 },
  { id: "1002345", name: "Lucía Fernández", tickets: 120 },
  { id: "1006789", name: "Diego Sánchez", tickets: 90 },
  { id: "1000123", name: "Camila Torres", tickets: 175 },
  { id: "1004567", name: "Andrés Ramírez", tickets: 60 },
  { id: "1008901", name: "Valentina Díaz", tickets: 250 },
  { id: "1001111", name: "Roberto Herrera", tickets: 110 },
  { id: "1002222", name: "Sofía Morales", tickets: 45 },
  { id: "1003333", name: "Fernando Castro", tickets: 180 },
  { id: "1004444", name: "Isabella Vargas", tickets: 95 },
  { id: "1005555", name: "Miguel Ortiz", tickets: 220 },
  { id: "1006666", name: "Daniela Ruiz", tickets: 70 },
  { id: "1007777", name: "Alejandro Flores", tickets: 160 },
  { id: "1008888", name: "Paula Mendoza", tickets: 130 },
  { id: "1009999", name: "Gabriel Acosta", tickets: 85 },
  { id: "1000000", name: "Laura Jiménez", tickets: 2815 },
];

async function seed() {
  const pipeline = redis.pipeline();
  pipeline.del("tombola:weights", "tombola:names", "tombola:winners", "tombola:meta", "tombola:timestamps");

  let totalTickets = 0;
  for (const p of participants) {
    pipeline.hset("tombola:weights", p.id, String(p.tickets));
    pipeline.hset("tombola:names", p.id, p.name);
    totalTickets += p.tickets;
  }

  pipeline.hset("tombola:meta", {
    totalTickets: String(totalTickets),
    totalParticipants: String(participants.length),
    uploadedAt: new Date().toISOString(),
  });

  await pipeline.exec();
  console.log(`Seed: ${participants.length} participantes, ${totalTickets} tickets totales`);
  redis.disconnect();
}

seed().catch((err) => {
  console.error(err);
  redis.disconnect();
  process.exit(1);
});
