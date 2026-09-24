"use client";

import { useEffect, useRef, useState } from "react";
import ExtractedTable from "@/components/ExtractedTable";
import JobProgress from "@/components/JobProgress";
import { appendStatus } from "@/lib/job-progress.mjs";
import { buildTableGrid, extractionError } from "@/lib/table-grid.mjs";

export default function UploadDemo() {
  const [busy, setBusy] = useState(null);
  const [runKind, setRunKind] = useState("extraction");
  const [finishedAt, setFinishedAt] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [connectionNotice, setConnectionNotice] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const stream = useRef(null);
  const upload = useRef(null);

  useEffect(() => () => {
    upload.current?.abort();
    stream.current?.close();
  }, []);

  useEffect(() => {
    if (!selectedImage) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(selectedImage);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedImage]);

  function selectImage(event) {
    const image = event.target.files?.[0];
    setResult(null);
    setError(null);
    setStatuses([]);
    setFinishedAt(null);
    setConnectionNotice("");
    if (image && (!["image/png", "image/jpeg"].includes(image.type) || !image.size || image.size > 8 * 1024 * 1024)) {
      setSelectedImage(null);
      setError({ message: "Choose a PNG or JPG image, up to 8 MB." });
      return;
    }
    setSelectedImage(image || null);
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    const form = new FormData(event.currentTarget);
    const image = form.get("image");
    const kind = event.nativeEvent.submitter?.value === "startup_test" ? "startup_test" : "extraction";
    form.set("kind", kind);

    setResult(null);
    setError(null);
    setStatuses([]);
    setFinishedAt(null);
    setConnectionNotice("");

    if (!image?.size || !["image/png", "image/jpeg"].includes(image.type) || image.size > 8 * 1024 * 1024) {
      setError({ message: "Choose a PNG or JPG image, up to 8 MB." });
      return;
    }

    stream.current?.close();
    setSelectedImage(image);
    setBusy(kind);
    setRunKind(kind);
    setStatuses(appendStatus([], { step: "uploading", message: "Uploading image…" }));
    const controller = new AbortController();
    upload.current = controller;

    try {
      const response = await fetch("/api/jobs", {
        method: "POST", body: form, signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Upload failed. Please try again.");
      if (typeof data?.jobId !== "string" || !data.jobId) throw new Error("The server did not return a job ID. Please try again.");
      if (controller.signal.aborted) return;

      const events = new EventSource(`/api/jobs/${encodeURIComponent(data.jobId)}/events`);
      stream.current = events;

      const finish = () => {
        events.close();
        if (stream.current === events) stream.current = null;
        setConnectionNotice("");
        setFinishedAt(Date.now());
        setBusy(null);
      };

      const invalidEvent = () => {
        setError({ message: "The server returned an unreadable extraction response. Please try again." });
        finish();
      };

      events.addEventListener("status", (event) => {
        try {
          const status = JSON.parse(event.data);
          if (typeof status?.message !== "string" || typeof status.step !== "string") throw new Error("Invalid progress event");
          setConnectionNotice("");
          setStatuses((previous) => appendStatus(previous, status));
        } catch {
          invalidEvent();
        }
      });

      events.addEventListener("complete", (event) => {
        try {
          const completed = JSON.parse(event.data)?.result;
          if (completed?.success !== true || completed.kind !== kind) {
            throw new Error("The server did not return the requested result. Please try again.");
          }
          const grid = kind === "extraction" ? buildTableGrid(completed.table) : null;
          setError(null);
          setResult({ payload: completed, grid, filename: image.name });
        } catch (failure) {
          setError({ message: failure instanceof SyntaxError
            ? "The server returned an unreadable extraction response. Please try again."
            : failure.message });
        }
        finish();
      });

      events.addEventListener("failed", (event) => {
        try {
          setError(extractionError(JSON.parse(event.data)));
          finish();
        } catch {
          invalidEvent();
        }
      });

      events.onerror = () => {
        if (events.readyState === EventSource.CLOSED) {
          setError({ message: "Progress updates are unavailable. The background job may still be running." });
          finish();
        } else {
          setConnectionNotice("Reconnecting to progress updates. Your job continues in the background.");
        }
      };
    } catch (failure) {
      if (failure.name !== "AbortError") {
        setError({ message: failure.message || "Could not upload the image. Please try again." });
        setFinishedAt(Date.now());
        setBusy(null);
      }
    }
  }

  return (
    <div className="mt-5 space-y-6">
      <form onSubmit={submit} className="space-y-4" aria-busy={!!busy}>
        <label className="block text-[13px] font-medium text-ink-700">
          Table image (PNG or JPG, up to 8 MB)
          <input
            type="file" name="image" accept="image/png,image/jpeg" required disabled={!!busy}
            onChange={selectImage}
            className="mt-2 block w-full rounded-lg border border-ink-300 p-2 text-[13px] file:mr-3 file:rounded file:border-0 file:bg-ink-100 file:px-3 file:py-2"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" value="extraction" disabled={!!busy}
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-[13.5px] font-semibold text-white disabled:cursor-wait disabled:opacity-50">
            {busy === "extraction" ? "Extracting…" : "Extract table"}
          </button>
          <button type="submit" value="startup_test" disabled={!!busy}
            title="Check that the GPU starts and can run a CUDA calculation."
            className="rounded-lg border border-ink-300 px-3 py-2.5 text-[12.5px] font-medium text-ink-700 disabled:cursor-wait disabled:opacity-50">
            {busy === "startup_test" ? "Testing GPU…" : "Test GPU startup"}
          </button>
        </div>
        <p className="text-[12px] text-ink-500">
          The first run may take a few minutes to start the GPU and load the model.
          The GPU stays ready for 5 minutes after a run, and each new run resets that timer.
        </p>
        {busy && <p className="text-[12px] text-ink-500">Keep this page open for the result.</p>}
      </form>

      {statuses.length > 0 && (
        <JobProgress statuses={statuses} kind={runKind} busy={!!busy} complete={!!result}
          error={error} finishedAt={finishedAt} />
      )}
      {connectionNotice && <p role="status" className="text-[13px] text-amber-700">{connectionNotice}</p>}
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          {error.code === "nougat_failed" && <p className="mb-1 font-semibold">Nougat extraction failed</p>}
          {error.code === "llm_failed" && <p className="mb-1 font-semibold">Language model failed</p>}
          <p>{error.message}</p>
        </div>
      )}
      {result?.payload.kind === "startup_test" && (
        <p role="status" className="rounded-lg bg-emerald-50 p-4 text-[13px] text-emerald-800">
          GPU startup test passed. Select Extract table to process your image.
        </p>
      )}
      {result?.payload.kind === "extraction" && <p role="status" className="text-[13px] font-semibold text-emerald-800">Table extracted successfully.</p>}
      {preview && (
        <div className={`grid gap-6 ${result?.grid ? "lg:grid-cols-2" : ""}`}>
          <figure className="min-w-0 space-y-3">
            <figcaption className="break-words text-[13px] font-semibold text-ink-950">Source image · {selectedImage?.name}</figcaption>
            <div className="overflow-auto rounded-lg border border-ink-200 bg-white p-3">
              <img src={preview} alt="Uploaded table to extract" className="mx-auto h-auto max-h-[640px] max-w-full object-contain" />
            </div>
          </figure>
          {result?.grid && <div className="min-w-0"><ExtractedTable table={result.payload.table} grid={result.grid} filename={result.filename} /></div>}
        </div>
      )}
    </div>
  );
}
