import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import babel from "next/dist/compiled/babel/core.js";
import { appendStatus, buildJobProgress, formatElapsed } from "./job-progress.mjs";

const statuses = (...steps) => steps.map((step, index) => ({ step, message: step, receivedAt: index * 1000 }));
const stateOf = (progress, id) => progress.stages.find((stage) => stage.id === id).state;
const throughNougat = ["uploading", "queued", "starting", "pod_running", "backend_ready", "extracting", "nougat_started", "nougat_complete"];

test("progress advances only on pipeline events and reserves the last stage for the result", () => {
  assert.equal(buildJobProgress(statuses("uploading")).completed, 0);
  const running = buildJobProgress(statuses(...throughNougat));
  assert.equal(running.completed, 3);
  assert.equal(stateOf(running, "vision"), "waiting");
  const finishing = buildJobProgress(statuses(...throughNougat, "aligning_cells", "finalizing", "warm"));
  assert.equal(finishing.completed, 6);
  assert.equal(finishing.total, 7);
  assert.equal(stateOf(finishing, "finalize"), "active");
  const finished = buildJobProgress(statuses(...throughNougat, "warm"), { complete: true });
  assert.equal(finished.completed, finished.total);
  assert.ok(finished.stages.every((stage) => stage.state === "done"));
});

test("either expert can finish first without completing the other expert", () => {
  for (const first of ["vision", "text"]) {
    const other = first === "vision" ? "text" : "vision";
    const events = statuses(...throughNougat, "vision_started", "text_started", `${first}_complete`);
    const oneDone = buildJobProgress(events);
    assert.equal(stateOf(oneDone, first), "done");
    assert.equal(stateOf(oneDone, other), "active");
    assert.equal(stateOf(oneDone, "routing"), "waiting");
    const bothDone = buildJobProgress(appendStatus(events, { step: `${other}_complete`, message: "Finished" }));
    assert.equal(stateOf(bothDone, "vision"), "done");
    assert.equal(stateOf(bothDone, "text"), "done");
    assert.equal(bothDone.completed, 5);
  }
});

test("failed extraction preserves completed work and never claims 100 percent", () => {
  const events = statuses(...throughNougat, "vision_started", "text_started", "text_complete", "warm");
  const failed = buildJobProgress(events, { failed: true, failureStage: "vision" });
  assert.equal(stateOf(failed, "vision"), "failed");
  assert.equal(stateOf(failed, "text"), "done");
  assert.equal(stateOf(failed, "routing"), "waiting");
  assert.equal(stateOf(failed, "finalize"), "waiting");
  assert.equal(failed.completed, 4);
  assert.ok(failed.completed < failed.total);
  assert.equal(stateOf(buildJobProgress(statuses("uploading"), { failed: true }), "upload"), "stopped");
});

test("failure of one concurrent expert stops the other without calling it complete", () => {
  const failed = buildJobProgress(statuses(...throughNougat, "vision_started", "text_started"), {
    failed: true, failureStage: "text",
  });
  assert.equal(stateOf(failed, "text"), "failed");
  assert.equal(stateOf(failed, "vision"), "stopped");
});

test("replayed SSE events retain their first timestamps and cannot move progress backwards", () => {
  const original = statuses(...throughNougat, "vision_started", "text_started", "text_complete");
  const replayed = appendStatus(original, { step: "nougat_started", message: "Replayed" }, 999000);
  assert.equal(replayed, original);
  assert.deepEqual(buildJobProgress(replayed), buildJobProgress(original));
  const outOfOrder = appendStatus(statuses("vision_complete"), { step: "vision_started", message: "Earlier" });
  assert.equal(stateOf(buildJobProgress(outOfOrder), "vision"), "done");
});

test("a new run starts with fresh progress and elapsed time", () => {
  const first = statuses(...throughNougat, "finalizing");
  const second = appendStatus([], { step: "uploading", message: "Uploading image" }, 100000);
  assert.equal(buildJobProgress(first).completed, 6);
  assert.equal(buildJobProgress(second).completed, 0);
  assert.equal(second[0].receivedAt, 100000);
  assert.equal(formatElapsed(62000), "1:02");
  assert.equal(formatElapsed(-1000), "0:00");
});

test("startup testing only shows upload, GPU preparation, and CUDA validation", () => {
  const events = statuses("uploading", "queued", "reusing", "backend_ready", "gpu_testing", "warm");
  const testing = buildJobProgress(events, { kind: "startup_test" });
  assert.deepEqual(testing.stages.map((stage) => stage.id), ["upload", "gpu", "cuda"]);
  assert.equal(testing.completed, 2);
  assert.equal(stateOf(testing, "cuda"), "active");
  assert.equal(buildJobProgress(events, { kind: "startup_test", complete: true }).completed, 3);
  assert.equal(stateOf(buildJobProgress(events, {
    kind: "startup_test", failed: true, failureStage: "nougat",
  }), "cuda"), "failed");
});

test("progress UI exposes stage counts, independent expert states, and elapsed time", async () => {
  const sourceUrl = new URL("../components/JobProgress.js", import.meta.url);
  const source = await readFile(sourceUrl, "utf8");
  const require = createRequire(sourceUrl);
  const { code } = babel.transformSync(source, {
    filename: "JobProgress.jsx", babelrc: false, configFile: false,
    presets: [[require.resolve("next/babel"), { "preset-env": { modules: "commonjs" }, "preset-react": { runtime: "automatic" } }]],
  });
  const component = {};
  new Function("require", "exports", code)((name) => name === "@/lib/job-progress.mjs"
    ? { buildJobProgress, formatElapsed } : require(name), component);
  const html = renderToStaticMarkup(React.createElement(component.default, {
    statuses: statuses(...throughNougat, "vision_started", "text_started", "text_complete"),
    kind: "extraction", busy: true, complete: false, finishedAt: 62000,
  }));
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-valuenow="4"/);
  assert.match(html, /aria-valuemax="7"/);
  assert.match(html, /running: Vision expert/);
  assert.match(html, /1:02/);
  assert.match(html, /Progress details/);
  assert.match(html, /motion-reduce:transition-none/);
});
