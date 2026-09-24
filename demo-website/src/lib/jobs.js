import { randomUUID } from "node:crypto";
import { createClient } from "redis";

const jobKey = (id) => `table-demo:job:${id}`;
const imageKey = (id) => `${jobKey(id)}:image`;

// Reuse the connection across requests and development hot reloads.
async function redis() {
  if (!globalThis.tableDemoRedis) {
    const client = createClient({
      url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
      socket: { connectTimeout: 3000, reconnectStrategy: false },
      disableOfflineQueue: true,
    });
    client.on("error", (error) => console.error("Redis:", error.message));
    globalThis.tableDemoRedis = client.connect().then(() => client).catch((error) => {
      delete globalThis.tableDemoRedis;
      throw error;
    });
    client.on("end", () => { delete globalThis.tableDemoRedis; });
  }
  return globalThis.tableDemoRedis;
}

export async function createJob(image, kind = "extraction") {
  if (!["extraction", "startup_test"].includes(kind)) throw new Error("Unsupported job kind.");
  const client = await redis();
  const job = {
    id: randomUUID(), filename: image.name, contentType: image.type, state: "queued", kind,
  };
  await client.multi()
    .set(jobKey(job.id), JSON.stringify(job))
    .set(imageKey(job.id), Buffer.from(await image.arrayBuffer()))
    .rPush(`${jobKey(job.id)}:events`, JSON.stringify({
      event: "status", data: { step: "queued", message: "Waiting for a GPU pod…" },
    }))
    .xAdd("table-demo:queue", "*", { jobId: job.id })
    .exec();
  return job;
}

export async function getJob(id) {
  const client = await redis();
  const value = await client.get(jobKey(id));
  return value ? JSON.parse(value) : null;
}

export async function getJobEvents(id, start) {
  const client = await redis();
  return (await client.lRange(`${jobKey(id)}:events`, start, -1)).map(JSON.parse);
}
