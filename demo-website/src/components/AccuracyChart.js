"use client";

import { useState } from "react";
import { MAIN_RESULTS } from "@/data/results";

const SERIES = [
  { key: "vision", label: "Vision expert", color: "var(--color-series-vision)", shape: "circle" },
  { key: "text", label: "Text expert", color: "var(--color-series-text)", shape: "circle" },
  { key: "rf", label: "Router (Random Forest)", color: "var(--color-series-router)", shape: "diamond" },
  { key: "oracle", label: "Oracle ceiling", color: "var(--color-series-oracle)", shape: "ring" },
];

const MIN = 62;
const MAX = 94;
const pos = (v) => ((v - MIN) / (MAX - MIN)) * 100;

/**
 * Per-cell extraction accuracy for each dataset x backbone configuration.
 * A dot plot rather than grouped bars: the story is the distance between the
 * single experts, the router, and the oracle ceiling on one shared scale.
 */
export default function AccuracyChart() {
  const [showTable, setShowTable] = useState(false);
  const [hover, setHover] = useState(null);

  return (
    <figure className="rounded-xl border border-ink-200 bg-white p-5 sm:p-7">
      <figcaption className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-ink-950">
            Per-cell extraction accuracy across all eight configurations
          </h3>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-500">
            The Random Forest router lands above both single experts in every
            configuration, and part-way toward the oracle ceiling.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="shrink-0 rounded-md border border-ink-200 px-2.5 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-ink-50"
        >
          {showTable ? "Show chart" : "Show table"}
        </button>
      </figcaption>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
        {SERIES.map((s) => (
          <span
            key={s.key}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-700"
          >
            <Glyph shape={s.shape} color={s.color} />
            {s.label}
          </span>
        ))}
      </div>

      {showTable ? (
        <TableView />
      ) : (
        <div className="mt-6">
          {["A25", "SciTSR"].map((ds) => (
            <div key={ds} className="mb-6 last:mb-0">
              <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                {ds}
              </p>
              <div className="space-y-1">
                {MAIN_RESULTS.filter((r) => r.dataset === ds).map((r) => (
                  <Row
                    key={r.dataset + r.model}
                    row={r}
                    hover={hover}
                    setHover={setHover}
                  />
                ))}
              </div>
            </div>
          ))}
          <Axis />
        </div>
      )}
    </figure>
  );
}

function Row({ row, hover, setHover }) {
  const best = Math.max(row.vision, row.text);
  const id = row.dataset + row.model;
  return (
    <div className="group grid grid-cols-[92px_1fr] items-center gap-3 rounded-md px-1 py-2 hover:bg-ink-50 sm:grid-cols-[120px_1fr]">
      <p className="truncate text-[12.5px] font-medium text-ink-900">{row.model}</p>
      <div className="relative h-7">
        {/* headroom track: best single expert -> oracle */}
        <span
          className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-ink-200"
          style={{ left: `${pos(best)}%`, width: `${pos(row.oracle) - pos(best)}%` }}
        />
        {/* captured portion: best single expert -> router */}
        <span
          className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full"
          style={{
            left: `${pos(best)}%`,
            width: `${pos(row.rf) - pos(best)}%`,
            background: "color-mix(in oklab, var(--color-series-router) 45%, white)",
          }}
        />
        {SERIES.map((s) => {
          const key = `${id}-${s.key}`;
          return (
            <button
              key={s.key}
              type="button"
              onMouseEnter={() => setHover(key)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(key)}
              onBlur={() => setHover(null)}
              aria-label={`${row.model} ${s.label} ${row[s.key].toFixed(2)} percent`}
              className="absolute top-1/2 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full outline-none"
              style={{ left: `${pos(row[s.key])}%` }}
            >
              <Glyph shape={s.shape} color={s.color} size={s.key === "rf" ? 12 : 10} ring />
              {hover === key && (
                <span className="pointer-events-none absolute bottom-full z-20 mb-1 whitespace-nowrap rounded-md bg-ink-950 px-2 py-1 text-[11px] font-medium text-white shadow-lg">
                  {s.label}: {row[s.key].toFixed(2)}%
                </span>
              )}
            </button>
          );
        })}
        <span
          className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap pl-2 text-[11.5px] font-semibold tabular-nums text-router"
          style={{ left: `${pos(row.oracle)}%` }}
        >
          +{row.gain.toFixed(2)} pp
        </span>
      </div>
    </div>
  );
}

function Axis() {
  const ticks = [65, 70, 75, 80, 85, 90];
  return (
    <div className="grid grid-cols-[92px_1fr] gap-3 sm:grid-cols-[120px_1fr]">
      <span />
      <div className="relative h-6 border-t border-ink-200">
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute top-1 -translate-x-1/2 text-[11px] tabular-nums text-ink-500"
            style={{ left: `${pos(t)}%` }}
          >
            {t}%
          </span>
        ))}
      </div>
    </div>
  );
}

function TableView() {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="num-table w-full min-w-[520px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-ink-300 text-[11.5px] uppercase tracking-wide text-ink-500">
            <th className="py-2 pr-3 font-semibold">Dataset</th>
            <th className="py-2 pr-3 font-semibold">Backbone</th>
            <th className="py-2 pr-3 text-right font-semibold">Vision</th>
            <th className="py-2 pr-3 text-right font-semibold">Text</th>
            <th className="py-2 pr-3 text-right font-semibold">Router</th>
            <th className="py-2 pr-3 text-right font-semibold">Oracle</th>
            <th className="py-2 text-right font-semibold">Gain</th>
          </tr>
        </thead>
        <tbody>
          {MAIN_RESULTS.map((r) => (
            <tr key={r.dataset + r.model} className="border-b border-ink-100">
              <td className="py-2 pr-3 text-ink-500">{r.dataset}</td>
              <td className="py-2 pr-3 font-medium text-ink-900">{r.model}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{r.vision.toFixed(2)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{r.text.toFixed(2)}</td>
              <td className="py-2 pr-3 text-right font-semibold tabular-nums text-router">
                {r.rf.toFixed(2)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-ink-500">
                {r.oracle.toFixed(2)}
              </td>
              <td className="py-2 text-right font-semibold tabular-nums">
                +{r.gain.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Glyph({ shape, color, size = 10, ring = false }) {
  const base = {
    width: size,
    height: size,
    background: shape === "ring" ? "transparent" : color,
    border: shape === "ring" ? `2.5px solid ${color}` : ring ? "2px solid white" : "none",
    boxShadow: ring ? "0 0 0 0.5px rgba(15,23,42,0.12)" : "none",
  };
  if (shape === "diamond") {
    return (
      <span
        style={{ ...base, transform: "rotate(45deg)", borderRadius: 2 }}
        className="inline-block shrink-0"
      />
    );
  }
  return <span style={{ ...base, borderRadius: 999 }} className="inline-block shrink-0" />;
}
