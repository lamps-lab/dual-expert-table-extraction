import { ROUTER_RANKS } from "@/data/results";

/**
 * Single-series magnitude comparison: average rank of each router family across
 * the eight configurations (lower is better). One hue, direct labels, no legend.
 */
export default function RankChart() {
  const max = 5;
  return (
    <figure className="rounded-xl border border-ink-200 bg-white p-5 sm:p-7">
      <figcaption>
        <h3 className="text-[15px] font-semibold tracking-tight text-ink-950">
          Average rank of five router families (lower is better)
        </h3>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
          Ranked by gain over the best single expert in each of the eight
          dataset &times; backbone configurations.
        </p>
      </figcaption>

      <div className="mt-6 space-y-2.5">
        {ROUTER_RANKS.map((r, i) => (
          <div key={r.short} className="grid grid-cols-[132px_1fr] items-center gap-3">
            <p className={`truncate text-[12.5px] ${i === 0 ? "font-semibold text-ink-950" : "text-ink-700"}`}>
              {r.model}
            </p>
            <div className="flex items-center gap-2.5">
              <div className="h-5 flex-1 rounded-r-[4px] bg-ink-100/70">
                <div
                  className="h-5 rounded-r-[4px]"
                  style={{
                    width: `${(r.rank / max) * 100}%`,
                    background:
                      i === 0
                        ? "var(--color-series-router)"
                        : "color-mix(in oklab, var(--color-series-router) 32%, white)",
                  }}
                />
              </div>
              <span className="w-9 shrink-0 text-right text-[12.5px] font-semibold tabular-nums text-ink-900">
                {r.rank.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 border-l-2 border-ink-200 pl-4 text-[12.5px] leading-relaxed text-ink-500">
        Random Forest is adopted as the standard router for all reported
        robustness experiments.
      </p>
    </figure>
  );
}
