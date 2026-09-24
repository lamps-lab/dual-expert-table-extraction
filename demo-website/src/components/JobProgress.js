"use client";

import { useEffect, useState } from "react";
import { buildJobProgress, formatElapsed } from "@/lib/job-progress.mjs";

const stateLabels = { done: "Done", active: "Running", waiting: "Waiting", failed: "Failed", stopped: "Stopped" };

export default function JobProgress({ statuses, kind, busy, complete, error, finishedAt }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!busy) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [busy]);

  const progress = buildJobProgress(statuses, { kind, complete, failed: !!error, failureStage: error?.stage });
  const title = complete ? (kind === "startup_test" ? "GPU test complete" : "Extraction complete")
    : error ? "Run stopped" : kind === "startup_test" ? "Testing the GPU" : "Extracting your table";
  const active = progress.stages.filter((stage) => stage.state === "active").map((stage) => stage.label);
  const elapsed = formatElapsed((finishedAt || now) - statuses[0].receivedAt);
  const latest = statuses.filter((status) => status.step !== "warm").at(-1)?.message;

  return (
    <section aria-label="Job progress" className="overflow-hidden rounded-xl border border-ink-200 bg-ink-50">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[14px] font-semibold text-ink-950">{title}</h3>
          <p className="text-[12px] tabular-nums text-ink-500">Elapsed <span className="font-medium text-ink-700">{elapsed}</span></p>
        </div>
        <div>
          <div className="mb-2 flex flex-wrap justify-between gap-2 text-[12px] text-ink-500">
            <p aria-live="polite">{progress.completed} of {progress.total} stages complete</p>
            <p>Progress follows completed stages</p>
          </div>
          <div role="progressbar" aria-label={kind === "startup_test" ? "GPU test stages" : "Table extraction stages"}
            aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.completed}
            aria-valuetext={`${progress.completed} of ${progress.total} stages complete${active.length ? `; running: ${active.join(" and ")}` : ""}`}
            className="h-2 overflow-hidden rounded-full bg-ink-200">
            <div className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${error ? "bg-red-500" : complete ? "bg-emerald-600" : "bg-brand-600"}`}
              style={{ width: `${progress.completed / progress.total * 100}%` }} />
          </div>
        </div>
        <ol className="grid gap-2 sm:grid-cols-2">
          {progress.stages.map((stage) => (
            <li key={stage.id} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[12px] ${
              stage.state === "active" ? "border-brand-100 bg-brand-50 text-brand-700"
                : stage.state === "failed" ? "border-red-200 bg-red-50 text-red-700"
                : "border-transparent bg-white/70 text-ink-700"}`}>
              <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                stage.state === "done" ? "bg-emerald-100 text-emerald-700"
                  : stage.state === "active" ? "bg-brand-100 text-brand-700"
                  : stage.state === "failed" ? "bg-red-100 text-red-700" : "bg-ink-100 text-ink-500"}`}>
                {stage.state === "done" ? "✓" : stage.state === "failed" || stage.state === "stopped" ? "!"
                  : stage.state === "active" ? <span className="h-2 w-2 rounded-full bg-brand-600 motion-safe:animate-pulse" /> : "·"}
              </span>
              <span className="font-medium">{stage.label}</span>
              <span className="ml-auto text-[11px]">{stateLabels[stage.state]}</span>
            </li>
          ))}
        </ol>
        {busy && <p role="status" className="text-[12px] leading-relaxed text-ink-700">{latest}</p>}
        {busy && active.some((label) => label.includes("expert")) && (
          <p className="text-[12px] text-ink-500">The vision and text experts run at the same time. Each finishes independently.</p>
        )}
      </div>
      <details className="border-t border-ink-200 bg-white/60 px-4 py-3 sm:px-5">
        <summary className="cursor-pointer text-[12px] font-medium text-ink-700">Progress details</summary>
        <ol className="mt-3 space-y-1.5 text-[12px] leading-relaxed text-ink-500">
          {statuses.map((status) => <li key={status.step}>{status.message}</li>)}
        </ol>
      </details>
    </section>
  );
}
