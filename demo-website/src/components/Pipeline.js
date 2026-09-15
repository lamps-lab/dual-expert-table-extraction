import { Pill } from "@/components/ui";

/**
 * Four-stage overview of the framework, mirroring Figure 1 of the paper.
 * Built with flow boxes + CSS chevrons so it stays legible down to mobile widths.
 */
export default function Pipeline({ compact = false }) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-gradient-to-b from-ink-50 to-white p-5 sm:p-7">
      <div className="grid gap-4 lg:grid-cols-[0.85fr_auto_1.15fr_auto_1fr_auto_0.8fr] lg:items-stretch">
        <Stage index="1" title="Input">
          <MiniTable />
          <p className="mt-3 text-[12.5px] leading-snug text-ink-500">
            One rendered table image from a scientific PDF.
          </p>
        </Stage>

        <Arrow />

        <Stage index="2" title="Dual perception">
          <div className="space-y-2.5">
            <Branch tone="vision" label="Vision expert">
              Vision&ndash;language model reads the rendered image directly and
              emits cells.
            </Branch>
            <Branch tone="textexp" label="Text expert">
              Nougat converts image &rarr; LaTeX; an LLM parses the markup into
              the same cell schema.
            </Branch>
          </div>
          <CodeLine>{`{sr, er, sc, ec, text}`}</CodeLine>
        </Stage>

        <Arrow />

        <Stage index="3" title="Alignment &amp; routing">
          <div className="space-y-2.5">
            <Branch tone="router" label="Bipartite alignment">
              Hungarian matching on grid-IoU, tie-broken by Levenshtein
              similarity, yields decision units.
            </Branch>
            <Branch tone="router" label="Per-cell router">
              A lightweight classifier scores content, structural and agreement
              features to pick an expert.
            </Branch>
          </div>
          <CodeLine>{`P(vision) ∈ [0, 1]`}</CodeLine>
        </Stage>

        <Arrow />

        <Stage index="4" title="Output">
          <div className="space-y-2">
            <OutRow>Spans &amp; values per cell</OutRow>
            <OutRow>Single merged table</OutRow>
            <OutRow>Machine-readable JSON</OutRow>
          </div>
          {!compact && (
            <p className="mt-3 text-[12.5px] leading-snug text-ink-500">
              Beats the better single expert in all 8 dataset &times; backbone
              configurations.
            </p>
          )}
        </Stage>
      </div>
    </div>
  );
}

function Stage({ index, title, children }) {
  return (
    <div className="flex flex-col rounded-xl border border-ink-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-5 w-5 place-items-center rounded bg-ink-950 text-[11px] font-semibold text-white">
          {index}
        </span>
        <h3 className="text-[13px] font-semibold tracking-tight text-ink-950">
          {title}
        </h3>
      </div>
      <div className="mt-3 flex-1">{children}</div>
    </div>
  );
}

function Branch({ tone, label, children }) {
  const ring = {
    vision: "border-vision/25 bg-vision-soft/40",
    textexp: "border-textexp/25 bg-textexp-soft/40",
    router: "border-router/25 bg-router-soft/40",
  }[tone];
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${ring}`}>
      <Pill tone={tone}>{label}</Pill>
      <p className="mt-2 text-[12px] leading-snug text-ink-700">{children}</p>
    </div>
  );
}

function CodeLine({ children }) {
  return (
    <p className="mt-3 rounded-md bg-ink-950 px-2.5 py-1.5 font-mono text-[11px] text-ink-100">
      {children}
    </p>
  );
}

function OutRow({ children }) {
  return (
    <p className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-700">
      <svg
        className="mt-0.5 shrink-0 text-brand-600"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <path
          d="m5 13 4 4L19 7"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </p>
  );
}

function Arrow() {
  return (
    <div
      className="flex items-center justify-center text-ink-300 lg:px-0"
      aria-hidden
    >
      <svg
        className="rotate-90 lg:rotate-0"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M4 12h15m0 0-5.5-5.5M19 12l-5.5 5.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function MiniTable() {
  const rows = [
    ["Method", "Top-1", "Top-5"],
    ["ResNet-50", "76.3", "93.1"],
    ["ResNeXt-101", "77.9", "93.8"],
    ["DenseNet-121", "74.3", "91.6"],
  ];
  return (
    <div className="overflow-hidden rounded-md border border-ink-200">
      <table className="num-table w-full text-[10.5px]">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i === 0 ? "bg-ink-100 font-semibold" : ""}>
              {r.map((c, j) => (
                <td
                  key={j}
                  className={`border-b border-ink-200 px-2 py-1 text-ink-700 ${
                    j > 0 ? "text-right tabular-nums" : ""
                  }`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
