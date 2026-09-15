import AccuracyChart from "@/components/AccuracyChart";
import RankChart from "@/components/RankChart";
import { Section, Card, Stat, Note, Pill } from "@/components/ui";
import { MAIN_RESULTS, DATASET_STATS, HEADLINE } from "@/data/results";

export const metadata = {
  title: "Results",
  description:
    "Per-cell extraction accuracy for vision experts, text experts, the learned router, LLM arbiters, and the oracle ceiling across two datasets and four backbones.",
};

export default function ResultsPage() {
  return (
    <>
      <PageHeader />
      <Headline />
      <MainChart />
      <FullTable />
      <RouterFamilies />
      <Datasets />
      <Limitations />
    </>
  );
}

function PageHeader() {
  return (
    <div className="border-b border-ink-200 bg-ink-50">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-brand-600">
          Evaluation
        </p>
        <h1 className="rule-heading mt-3 max-w-3xl text-[34px] font-semibold leading-tight text-ink-950 sm:text-[42px]">
          Eight configurations, eight improvements
        </h1>
        <p className="mt-5 max-w-2xl text-[15.5px] leading-relaxed text-ink-700">
          Two datasets &times; four backbone models, each run with a vision
          expert, a text expert, five learned router families and two LLM
          arbiters. All numbers are per-cell accuracy on held-out test tables
          under the strict span-plus-text criterion.
        </p>
      </div>
    </div>
  );
}

function Headline() {
  return (
    <Section className="py-12 sm:py-14">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          tone="router"
          value={`+${HEADLINE.avgGain}`}
          unit="pp"
          label="Average gain over best expert"
          sub={`Consistent across configurations: +${HEADLINE.minGain} to +${HEADLINE.maxGain} pp`}
        />
        <Stat value="1.62" label="Random Forest average rank" sub="Best of five router families across all eight configurations" />
        <Stat value={`${HEADLINE.backbones}`} label="Backbone models" sub="GPT-4o, Gemini 3.1, Gemma 4, Qwen 3.6 — proprietary and open-weight" />
        <Stat tone="oracle" value="4–13" unit="pp" label="Remaining oracle headroom" sub="Varies widely by configuration while the router's gain stays stable" />
      </div>
    </Section>
  );
}

function MainChart() {
  return (
    <Section className="py-6 sm:py-8">
      <AccuracyChart />
    </Section>
  );
}

function FullTable() {
  return (
    <Section
      className="py-14 sm:py-16"
      eyebrow="Table 4"
      title="Robustness of the dual-expert framework"
      lead="The Gain column reports the absolute percentage-point improvement of the Random Forest router over the better of the two single-expert baselines."
    >
      <div className="mt-8 overflow-x-auto rounded-xl border border-ink-200">
        <table className="num-table w-full min-w-[760px] text-[13.5px]">
          <thead>
            <tr className="border-b border-ink-200 bg-ink-50 text-left text-[11px] uppercase tracking-wide text-ink-500">
              <th className="px-4 py-2 font-semibold">Dataset</th>
              <th className="px-4 py-2 font-semibold">Backbone</th>
              <th className="px-3 py-2 text-right font-semibold">Vision</th>
              <th className="px-3 py-2 text-right font-semibold">Text</th>
              <th className="px-3 py-2 text-right font-semibold">RF router</th>
              <th className="px-3 py-2 text-right font-semibold">GLM 5.2</th>
              <th className="px-3 py-2 text-right font-semibold">GPT 5.6</th>
              <th className="px-3 py-2 text-right font-semibold">Oracle</th>
              <th className="px-4 py-2 text-right font-semibold">Gain</th>
            </tr>
          </thead>
          <tbody>
            {MAIN_RESULTS.map((r, i) => {
              const best = Math.max(r.vision, r.text);
              const firstOfGroup = i === 0 || MAIN_RESULTS[i - 1].dataset !== r.dataset;
              return (
                <tr
                  key={r.dataset + r.model}
                  className={`border-b border-ink-100 last:border-0 ${
                    firstOfGroup && i !== 0 ? "border-t-2 border-t-ink-200" : ""
                  }`}
                >
                  <td className="px-4 py-2.5 text-ink-500">
                    {firstOfGroup ? r.dataset : ""}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-ink-900">{r.model}</td>
                  <Num v={r.vision} best={best} />
                  <Num v={r.text} best={best} />
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-router">
                    {r.rf.toFixed(2)}
                  </td>
                  <Num v={r.glm} />
                  <Num v={r.gpt} />
                  <td className="px-3 py-2.5 text-right tabular-nums text-oracle">
                    {r.oracle.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-ink-950">
                    +{r.gain.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Note>
        Bold-weighted column: the adopted Random Forest router. GLM 5.2 and GPT
        5.6 are LLM arbiters given both experts&rsquo; cell predictions as JSON
        in-prompt, with no explicit alignment step; underlined single-expert
        values are the per-row baseline the Gain is measured against.
      </Note>
    </Section>
  );
}

function Num({ v, best }) {
  const isBest = best !== undefined && v === best;
  return (
    <td
      className={`px-3 py-2.5 text-right tabular-nums ${
        isBest ? "font-medium text-ink-900 underline decoration-ink-300 underline-offset-4" : "text-ink-700"
      }`}
    >
      {v.toFixed(2)}
    </td>
  );
}

function RouterFamilies() {
  return (
    <Section
      className="py-14 sm:py-16"
      eyebrow="Router selection"
      title="The gain is intrinsic to the framework, not to one classifier"
      lead="All five router families yield positive gains in nearly all configurations. The tree-based ensemble consistently ranks highest, so Random Forest is adopted as the standard router for the robustness experiments."
    >
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <RankChart />
        <div className="space-y-4">
          <Card>
            <Pill tone="router">Finding</Pill>
            <h3 className="mt-3 text-[14.5px] font-semibold tracking-tight text-ink-950">
              A small classifier beats a large arbiter
            </h3>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-700">
              Both LLM arbiters trail the Random Forest in most configurations
              despite their far greater capacity, suggesting a lightweight
              per-cell router attends to the routing signal more reliably than a
              general-purpose arbiter reasoning over two full JSON readings.
            </p>
          </Card>
          <Card>
            <Pill tone="oracle">Finding</Pill>
            <h3 className="mt-3 text-[14.5px] font-semibold tracking-tight text-ink-950">
              Stable gain, variable ceiling
            </h3>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-700">
              The absolute gain stays near two percentage points even as the
              oracle gap varies widely across configurations &mdash; evidence
              that the router captures much of the complementary signal available
              from local, cell-level features, and that the rest lies in context
              the current feature set cannot see.
            </p>
          </Card>
        </div>
      </div>
    </Section>
  );
}

function Datasets() {
  return (
    <Section
      className="py-14 sm:py-16"
      eyebrow="Table 2"
      title="Two complementary benchmarks of complex tables"
      lead="A25 contributes complex scientific tables from four domains — Biology, Computer Science, ICDAR and Materials Science. SciTSR contributes a representative subset drawn from the tables its own annotations mark as complicated."
    >
      <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-ink-200">
          <table className="num-table w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50 text-left text-[11px] uppercase tracking-wide text-ink-500">
                <th className="px-4 py-2 font-semibold">Metric</th>
                <th className="px-4 py-2 text-right font-semibold">SciTSR</th>
                <th className="px-4 py-2 text-right font-semibold">A25</th>
              </tr>
            </thead>
            <tbody>
              {DATASET_STATS.map((s) => (
                <tr key={s.metric} className="border-b border-ink-100 last:border-0">
                  <td className="px-4 py-2.5 text-ink-700">{s.metric}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-900">{s.scitsr}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-900">{s.a25}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="text-[14.5px] font-semibold tracking-tight text-ink-950">
              Why a subset of SciTSR
            </h3>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-700">
              Running both experts across four backbones over the full 15,000-table
              corpus is computationally infeasible. Rather than sample at random,
              we started from the 716 tables SciTSR labels as complicated, kept
              the 666 that produced usable text-expert output, and randomly
              selected the final 157.
            </p>
          </Card>
          <Card>
            <h3 className="text-[14.5px] font-semibold tracking-tight text-ink-950">
              Structural difficulty
            </h3>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-700">
              The two benchmarks stress different failure modes: 86.0% of the
              SciTSR subset contains a multicolumn cell, while A25 tables are
              wider and deeper on average (up to 43 rows) with heavier
              domain-specific notation. Multi-row and multi-column cells are
              counted as separate per-table indicators, since one table may
              contain both.
            </p>
          </Card>
        </div>
      </div>
    </Section>
  );
}

function Limitations() {
  return (
    <Section className="py-14 sm:py-16" eyebrow="Scope" title="What these numbers do and do not claim">
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card>
          <h3 className="text-[14px] font-semibold text-ink-950">Cost</h3>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-700">
            The main cost is running both experts on every table. The router
            itself adds negligible overhead &mdash; but the framework is roughly
            twice the inference cost of a single-expert pipeline.
          </p>
        </Card>
        <Card>
          <h3 className="text-[14px] font-semibold text-ink-950">Remaining headroom</h3>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-700">
            The router closes only part of the oracle gap. Cell errors are rarely
            independent, so a router that attends to a cell&rsquo;s row, column
            and local neighborhood through graph-based context is a natural next
            step.
          </p>
        </Card>
        <Card>
          <h3 className="text-[14px] font-semibold text-ink-950">Beyond two experts</h3>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-700">
            The framework is not limited to two experts or to the four backbones
            studied here; widening the pool widens the space of complementary
            signal available to the router.
          </p>
        </Card>
      </div>
    </Section>
  );
}
