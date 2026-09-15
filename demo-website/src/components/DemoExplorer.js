"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Pill } from "@/components/ui";

const VIEWS = [
  { key: "gt", label: "Ground truth" },
  { key: "vision", label: "Vision expert" },
  { key: "text", label: "Text expert" },
  { key: "map", label: "Complementarity map" },
  { key: "router", label: "Routed output" },
];

export default function DemoExplorer({ samples }) {
  const [sampleId, setSampleId] = useState(samples[0].id);
  const [view, setView] = useState("map");
  const [selected, setSelected] = useState(null);

  const sample = samples.find((s) => s.id === sampleId) ?? samples[0];

  const grid = useMemo(() => buildGrid(sample), [sample]);
  const cell =
    selected != null
      ? sample.cells.find((c) => cellKey(c) === selected) ?? null
      : null;

  const pick = (s) => {
    setSampleId(s.id);
    setSelected(null);
  };

  return (
    <div>
      {/* Example selector */}
      <div className="flex flex-wrap gap-2">
        {samples.map((s) => {
          const active = s.id === sample.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => pick(s)}
              className={`rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                active
                  ? "border-brand-600 bg-brand-50"
                  : "border-ink-200 bg-white hover:bg-ink-50"
              }`}
            >
              <span
                className={`block text-[13px] font-semibold ${
                  active ? "text-brand-700" : "text-ink-900"
                }`}
              >
                {s.domain}
              </span>
              <span className="mt-0.5 block font-mono text-[11px] text-ink-500">
                {s.table} · {s.nRows}×{s.nCols} · {s.disagreements} routable
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        {/* Left: source image + per-table stats */}
        <div className="space-y-4">
          <figure className="rounded-xl border border-ink-200 bg-white p-4">
            <figcaption className="mb-3 flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-ink-950">
                Input table image
              </span>
              <Pill tone="neutral">A25 · {sample.domain}</Pill>
            </figcaption>
            <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
              <Image
                src={sample.image}
                alt={`Rendered table ${sample.table} from the ${sample.domain} domain`}
                width={900}
                height={600}
                className="h-auto w-full object-contain"
                priority
              />
            </div>
          </figure>

          <div className="grid grid-cols-2 gap-3">
            <MiniStat
              label="Vision expert"
              value={sample.visionAcc}
              tone="vision"
            />
            <MiniStat label="Text expert" value={sample.textAcc} tone="textexp" />
            <MiniStat label="Oracle ceiling" value={sample.oracle} tone="oracle" />
            <div className="rounded-xl border border-ink-200 bg-white p-4">
              <p className="rule-heading text-[24px] font-semibold leading-none text-router">
                {sample.disagreements}
              </p>
              <p className="mt-2 text-[12.5px] font-semibold text-ink-900">
                Routable cells
              </p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-ink-500">
                of {sample.nCells} — exactly one expert correct
              </p>
            </div>
          </div>

          <CellInspector cell={cell} />
        </div>

        {/* Right: view switcher + rendered grid */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-ink-200 bg-ink-50 p-1.5">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                className={`rounded-md px-3 py-2 text-[12.5px] font-medium transition-colors ${
                  view === v.key
                    ? "bg-white text-ink-950 shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
                    : "text-ink-500 hover:text-ink-900"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-ink-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12.5px] font-semibold text-ink-950">
                {VIEWS.find((v) => v.key === view).label}
              </p>
              {view === "router" && (
                <Pill tone="router">Placeholder selection — see note below</Pill>
              )}
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-[12.5px]">
                <tbody>
                  {grid.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((c) => (
                        <GridCell
                          key={cellKey(c)}
                          cell={c}
                          view={view}
                          selected={selected === cellKey(c)}
                          onSelect={() =>
                            setSelected((prev) =>
                              prev === cellKey(c) ? null : cellKey(c)
                            )
                          }
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Legend view={view} />
          </div>
        </div>
      </div>
    </div>
  );
}

function GridCell({ cell, view, selected, onSelect }) {
  const value = displayValue(cell, view);
  const tone = cellTone(cell, view);

  return (
    <td
      rowSpan={cell.er - cell.sr + 1}
      colSpan={cell.ec - cell.sc + 1}
      className={`border border-ink-200 p-0 align-top ${
        selected ? "outline outline-2 -outline-offset-2 outline-brand-600" : ""
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className={`h-full w-full px-2.5 py-2 text-left transition-colors ${tone}`}
      >
        {value === null ? (
          <span className="font-mono text-[11px] italic text-ink-500">
            not emitted
          </span>
        ) : value === "" ? (
          <span className="font-mono text-[11px] text-ink-300">—</span>
        ) : (
          <span className="font-mono leading-snug">{value}</span>
        )}
      </button>
    </td>
  );
}

function displayValue(c, view) {
  switch (view) {
    case "gt":
      return c.gt;
    case "vision":
      return c.vision;
    case "text":
      return c.text;
    case "router":
      // Placeholder: oracle selection stands in for the trained router.
      if (c.visionOk) return c.vision;
      if (c.textOk) return c.text;
      return c.vision ?? c.text;
    default:
      return c.gt;
  }
}

function cellTone(c, view) {
  if (view === "gt") return "bg-white text-ink-900 hover:bg-ink-50";

  if (view === "map") {
    if (c.visionOk && c.textOk) return "bg-ink-50 text-ink-500 hover:bg-ink-100";
    if (c.visionOk) return "bg-vision-soft text-vision hover:brightness-[0.97]";
    if (c.textOk) return "bg-textexp-soft text-textexp hover:brightness-[0.97]";
    return "bg-red-50 text-red-700 hover:bg-red-100";
  }

  if (view === "router") {
    if (c.visionOk || c.textOk) return "bg-white text-ink-900 hover:bg-ink-50";
    return "bg-red-50 text-red-700 hover:bg-red-100";
  }

  const ok = view === "vision" ? c.visionOk : c.textOk;
  return ok
    ? "bg-white text-ink-900 hover:bg-ink-50"
    : "bg-red-50 text-red-700 hover:bg-red-100";
}

function Legend({ view }) {
  if (view === "map") {
    return (
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-ink-100 pt-3 text-[11.5px] text-ink-700">
        <Swatch className="bg-vision-soft ring-vision/30">Only vision correct</Swatch>
        <Swatch className="bg-textexp-soft ring-textexp/30">Only text correct</Swatch>
        <Swatch className="bg-ink-100 ring-ink-300">Both correct</Swatch>
        <Swatch className="bg-red-100 ring-red-300">Both wrong</Swatch>
      </div>
    );
  }
  if (view === "router") {
    return (
      <p className="mt-4 border-t border-ink-100 pt-3 text-[11.5px] leading-relaxed text-ink-500">
        This static build shows the oracle selection — the correct expert
        wherever either was right — as a stand-in for the trained Random Forest
        router. Cells in red were missed by both experts and are unrecoverable by
        any selector.
      </p>
    );
  }
  if (view === "gt") {
    return (
      <p className="mt-4 border-t border-ink-100 pt-3 text-[11.5px] leading-relaxed text-ink-500">
        Human annotation from the benchmark, rendered with its original span
        structure.
      </p>
    );
  }
  return (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-ink-100 pt-3 text-[11.5px] text-ink-700">
      <Swatch className="bg-white ring-ink-300">Matches ground truth exactly</Swatch>
      <Swatch className="bg-red-100 ring-red-300">Span or text mismatch</Swatch>
    </div>
  );
}

function Swatch({ className, children }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-3 w-3 rounded-sm ring-1 ring-inset ${className}`} />
      {children}
    </span>
  );
}

function MiniStat({ label, value, tone }) {
  const color = {
    vision: "text-vision",
    textexp: "text-textexp",
    oracle: "text-oracle",
  }[tone];
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4">
      <p className={`rule-heading text-[24px] font-semibold leading-none ${color}`}>
        {value}
        <span className="ml-0.5 text-[14px] font-medium text-ink-500">%</span>
      </p>
      <p className="mt-2 text-[12.5px] font-semibold text-ink-900">{label}</p>
      <p className="mt-0.5 text-[11.5px] leading-snug text-ink-500">
        cells correct on this table
      </p>
    </div>
  );
}

function CellInspector({ cell }) {
  if (!cell) {
    return (
      <div className="rounded-xl border border-dashed border-ink-300 bg-ink-50 p-5">
        <p className="text-[13px] font-semibold text-ink-900">Cell inspector</p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-500">
          Select any cell in the table to compare the ground truth with both
          experts&rsquo; readings and see which one the router should trust.
        </p>
      </div>
    );
  }

  const routable = cell.visionOk !== cell.textOk;
  const winner = cell.visionOk ? "vision" : cell.textOk ? "text" : null;

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-ink-950">Cell inspector</p>
        <span className="font-mono text-[11px] text-ink-500">
          rows {cell.sr}–{cell.er} · cols {cell.sc}–{cell.ec}
        </span>
      </div>

      <dl className="mt-4 space-y-3">
        <Reading label="Ground truth" value={cell.gt} tone="neutral" />
        <Reading
          label="Vision expert"
          value={cell.vision}
          tone="vision"
          ok={cell.visionOk}
        />
        <Reading
          label="Text expert"
          value={cell.text}
          tone="textexp"
          ok={cell.textOk}
        />
      </dl>

      <div className="mt-4 rounded-lg bg-ink-50 px-3.5 py-3">
        <p className="text-[12px] font-semibold text-ink-950">
          {routable
            ? `Routable cell — the ${winner} expert is the correct choice here.`
            : winner
            ? "Both experts agree with the ground truth; routing is inconsequential."
            : "Neither expert is correct; this cell is outside the oracle ceiling."}
        </p>
        {routable && (
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">
            Cells like this one are the router&rsquo;s training signal: exactly
            one prediction matches ground truth, giving explicit supervision
            about which modality to trust.
          </p>
        )}
      </div>
    </div>
  );
}

function Reading({ label, value, tone, ok }) {
  const dot = {
    vision: "bg-vision",
    textexp: "bg-textexp",
    neutral: "bg-ink-400",
  }[tone];
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${dot ?? "bg-ink-300"}`} />
      <div className="min-w-0 flex-1">
        <dt className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
          {label}
          {ok !== undefined && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-normal ${
                ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              }`}
            >
              {ok ? "correct" : "incorrect"}
            </span>
          )}
        </dt>
        <dd className="mt-1 break-words font-mono text-[12.5px] text-ink-900">
          {value === null ? (
            <span className="italic text-ink-500">no cell emitted</span>
          ) : value === "" ? (
            <span className="text-ink-300">(empty)</span>
          ) : (
            value
          )}
        </dd>
      </div>
    </div>
  );
}

function cellKey(c) {
  return `${c.sr}-${c.sc}-${c.er}-${c.ec}`;
}

/** Bucket ground-truth cells into rows by their starting row index. */
function buildGrid(sample) {
  const rows = [];
  for (let r = 0; r < sample.nRows; r += 1) {
    const inRow = sample.cells
      .filter((c) => c.sr === r)
      .sort((a, b) => a.sc - b.sc);
    if (inRow.length) rows.push(inRow);
  }
  return rows;
}
