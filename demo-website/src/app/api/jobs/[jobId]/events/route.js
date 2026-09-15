import { setTimeout as delay } from "node:timers/promises";
import { getJob, getJobEvents } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { jobId } = await params;
  let job;
  try {
    job = await getJob(jobId);
  } catch (error) {
    console.error("Could not load job:", error);
    return Response.json({ error: "Job storage is unavailable." }, { status: 503 });
  }
  if (!job) {
    return Response.json({ error: "Job not found or expired." }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const lastId = request.headers.get("last-event-id");
  let cursor = lastId && /^\d+$/.test(lastId) ? Number(lastId) + 1 : 0;
  if (!Number.isSafeInteger(cursor)) cursor = 0;
  const cancellation = new AbortController();
  const abort = () => cancellation.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event, data, id) => {
        if (!cancellation.signal.aborted) {
          controller.enqueue(encoder.encode(`${id === undefined ? "" : `id: ${id}\n`}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        }
      };

      try {
        // Read persisted events only. The Python controller owns the job lifecycle.
        let idlePolls = 0;
        while (!cancellation.signal.aborted) {
          const events = await getJobEvents(jobId, cursor);
          for (const { event, data } of events) {
            send(event, data, cursor++);
            if (event === "complete" || event === "failed") return;
          }
          // Heartbeats keep an idle SSE connection open while a GPU is provisioned.
          if (++idlePolls % 15 === 0 && !cancellation.signal.aborted) {
            controller.enqueue(encoder.encode(": keep-alive\n\n"));
          }
          await delay(1000, undefined, { signal: cancellation.signal });
        }
      } catch (error) {
        if (!cancellation.signal.aborted) {
          console.error("Job stream failed:", error);
          // A storage/transport failure does not mean the background job failed.
          controller.error(error);
          cancellation.abort();
        }
      } finally {
        request.signal.removeEventListener("abort", abort);
        if (!cancellation.signal.aborted) controller.close();
      }
    },
    cancel: abort,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
