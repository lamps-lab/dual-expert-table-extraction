/** Keep the first observation of each stage when SSE events are replayed. */
export function appendStatus(statuses, status, receivedAt = Date.now()) {
  if (statuses.some((entry) => entry.step === status.step)) return statuses;
  return [...statuses, { ...status, receivedAt }];
}

/** Progress counts completed pipeline stages, never estimated processing time. */
export function buildJobProgress(statuses, {
  kind = "extraction", complete = false, failed = false, failureStage = null,
} = {}) {
  const seen = new Set(statuses.map((entry) => entry.step));
  const has = (...steps) => steps.some((step) => seen.has(step));
  const finalizing = has("finalizing");
  const routing = has("aligning_cells") || finalizing;
  const visionDone = has("vision_complete") || routing;
  const textDone = has("text_complete") || routing;
  const visionStarted = has("vision_started") || visionDone;
  const textStarted = has("text_started") || textDone;
  const nougatDone = has("nougat_complete") || visionStarted || textStarted;
  const nougatStarted = has("extracting", "nougat_started") || nougatDone;
  const gpuReady = has("backend_ready", "gpu_testing") || nougatStarted;
  const gpuStarted = has("queued", "starting", "reusing", "pod_running") || gpuReady;
  const stages = [
    { id: "upload", label: "Upload image", done: gpuStarted, active: has("uploading") },
    { id: "gpu", label: "Prepare GPU", done: gpuReady, active: gpuStarted },
    ...(kind === "startup_test" ? [
      { id: "cuda", label: "Test CUDA", done: false, active: gpuReady },
    ] : [
      { id: "nougat", label: "Nougat transcription", done: nougatDone, active: nougatStarted },
      { id: "vision", label: "Vision expert", done: visionDone, active: visionStarted },
      { id: "text", label: "Text expert", done: textDone, active: textStarted },
      { id: "routing", label: "Align and route cells", done: finalizing, active: routing },
      { id: "finalize", label: "Build table result", done: false, active: finalizing },
    ]),
  ];
  const failureId = {
    input: "upload", upload: "upload", startup: "gpu", nougat: kind === "startup_test" ? "cuda" : "nougat",
    vision: "vision", text: "text", router: "routing", response: "finalize",
  }[failureStage];
  const items = stages.map(({ done, active, ...stage }) => ({
    ...stage,
    state: complete ? "done" : failed && stage.id === failureId ? "failed"
      : done ? "done" : active ? (failed ? "stopped" : "active") : "waiting",
  }));
  const completed = items.filter((stage) => stage.state === "done").length;
  return { stages: items, completed, total: items.length };
}

export function formatElapsed(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
