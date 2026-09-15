"use client";

import { useEffect, useRef, useState } from "react";

export default function UploadDemo() {
  const [busy, setBusy] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const stream = useRef(null);
  const upload = useRef(null);

  useEffect(() => () => {
    upload.current?.abort();
    stream.current?.close();
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    const form = new FormData(event.currentTarget);
    const image = form.get("image");

    setResult(null);
    setError("");
    setStatuses([]);

    if (!image?.size || !["image/png", "image/jpeg"].includes(image.type) || image.size > 8 * 1024 * 1024) {
      setError("Choose a PNG or JPG image, up to 8 MB.");
      return;
    }

    setBusy(true);
    setStatuses([{ step: "uploading", message: "Uploading image…" }]);
    upload.current = new AbortController();

    try {

      const response = await fetch("/api/jobs", {
        method: "POST", body: form, signal: upload.current.signal,
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Upload failed.");

      if (upload.current.signal.aborted) return;

      const events = new EventSource(`/api/jobs/${data.jobId}/events`);
      stream.current = events;

      const finish = () => { events.close(); setBusy(false); };

      events.addEventListener("status", (event) => {
        setError("");
        setStatuses((previous) => [...previous, JSON.parse(event.data)]);
      });
      
      events.addEventListener("complete", (event) => {
        setError("");
        setResult(JSON.parse(event.data).result);
        finish();
      });

      events.addEventListener("failed", (event) => {
        setError(JSON.parse(event.data).message);
        finish();
      });

      events.onerror = () => {
        if (events.readyState === EventSource.CLOSED) {
          setError("The job stream is unavailable. The background job may still be running.");
          finish();
        } else {
          setError("Reconnecting to progress updates. Your job continues in the background.");
        }
      };
      
    } catch (error) {
      if (error.name !== "AbortError") {
        setError(error.message);
        setBusy(false);
      }
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <label className="block text-[13px] font-medium text-ink-700">
        Table image (PNG or JPG, up to 8 MB)
        <input
          type="file" name="image" accept="image/png,image/jpeg" required disabled={busy}
          className="mt-2 block w-full rounded-lg border border-ink-300 p-2 text-[13px] file:mr-3 file:rounded file:border-0 file:bg-ink-100 file:px-3 file:py-2"
        />
      </label>
      <button type="submit" disabled={busy}
        className="rounded-lg bg-brand-600 px-4 py-2.5 text-[13.5px] font-semibold text-white disabled:cursor-wait disabled:opacity-50">
        {busy ? "Running…" : "Test GPU pod"}
      </button>
      <div aria-live="polite" className="space-y-2 text-[13px] text-ink-700">
        {statuses.map((status, index) => <p key={index}>{status.message}</p>)}
        {result && <>
          <p className="font-semibold text-ink-950">{result.message}</p>
          <pre className="overflow-auto rounded-lg bg-ink-50 p-3 text-[12px]">{JSON.stringify(result, null, 2)}</pre>
        </>}
      </div>
      {error && <p role="alert" className="text-[13px] text-red-700">{error}</p>}
    </form>
  );
}
