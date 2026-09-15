import Link from "next/link";
import Pipeline from "@/components/Pipeline";
import AccuracyChart from "@/components/AccuracyChart";
import { Section, Card, Pill, Stat, Note } from "@/components/ui";
import { HEADLINE } from "@/data/results";

export default function Home() {
  return (
    <>
      <Hero />
      <Complementarity />
      <Framework />
      <ResultsTeaser />
      <Impact />
      <CallToAction />
      <Citation />
    </>
  );
}

function Hero() {
  return (
    <div className="relative overflow-hidden border-b border-ink-200">
      <div className="absolute inset-0 grid-backdrop" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-24">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="neutral">JCDL &rsquo;26 submission</Pill>
          <Pill tone="neutral">2 datasets &middot; 4 backbones &middot; 8 configurations</Pill>
        </div>

        <h1 className="rule-heading mt-6 max-w-4xl text-[36px] font-semibold leading-[1.08] text-ink-950 sm:text-[52px]">
          A dual-expert routing framework for structured data extraction from
          scientific tables
        </h1>

        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-700">
          Vision language models read table layout well but stumble on dense
          symbolic content. Text-based models preserve notation faithfully but
          mishandle complex structure. We stop treating these paradigms as
          competing alternatives, and treat their disagreement as{" "}
          <em className="font-medium not-italic text-ink-950">signal</em> routing each individual cell to the expert more likely to get it right.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Explore the live demo
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 12h15m0 0-5.5-5.5M19 12l-5.5 5.5"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <Link
            href="/method"
            className="inline-flex items-center rounded-lg border border-ink-300 bg-white px-5 py-3 text-[14.5px] font-semibold text-ink-900 transition-colors hover:bg-ink-50"
          >
            How it works
          </Link>
          <Link
            href="/results"
            className="inline-flex items-center rounded-lg px-2 py-3 text-[14.5px] font-semibold text-ink-700 underline decoration-ink-300 underline-offset-4 hover:text-brand-700"
          >
            Full results
          </Link>
        </div>

        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* <Stat
            tone="router"
            value={`${HEADLINE.wins}/${HEADLINE.configs}`}
            label="Configurations improved"
            sub="Router beats the best single expert in every dataset × backbone pairing"
          /> */}
          <Stat
            value={`+${HEADLINE.avgGain}`}
            unit="pp"
            label="Average absolute gain"
            sub={`Range +${HEADLINE.minGain} to +${HEADLINE.maxGain} percentage points`}
          />
          <Stat
            value={HEADLINE.tables.toLocaleString()}
            label="Complex tables evaluated"
            sub={`${HEADLINE.cells.toLocaleString()} annotated cells across A25 and SciTSR`}
          />
          {/* <Stat
            value="1"
            unit="× cost"
            label="Router overhead"
            sub="A lightweight per-cell classifier — negligible next to the two experts"
          /> */}
        </div>
      </div>
    </div>
  );
}

const COMPLEMENTARY = [
  { gt: "Ta1.0", vision: "Ta1.0", visionOk: true, text: "ta₁.₀", textOk: false },
  { gt: "tios†", vision: "tios+", visionOk: false, text: "tios†", textOk: true },
];

function Complementarity() {
  return (
    <Section
      className="py-16 sm:py-20"
      eyebrow="The observation"
      title="The two experts fail on different subsets of cells"
      lead="Within a single table, the vision expert recovers a numeric label the text expert mangles, while the text expert preserves a dagger symbol the vision expert normalizes away. Neither modality dominates, which means a selector operating at cell granularity has real headroom to exploit."
    >
      <div className="mt-9 grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-ink-950">
              Same table, same backbone (Gemma 4)
            </p>
            <Pill tone="neutral">Paper, Table 1</Pill>
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-ink-200">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-ink-50 text-left text-[11.5px] uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-2.5 font-semibold">Ground truth</th>
                  <th className="px-4 py-2.5 font-semibold">Vision expert</th>
                  <th className="px-4 py-2.5 font-semibold">Text expert</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {COMPLEMENTARY.map((r) => (
                  <tr key={r.gt} className="border-t border-ink-200">
                    <td className="px-4 py-3 text-ink-900">{r.gt}</td>
                    <Cellval ok={r.visionOk}>{r.vision}</Cellval>
                    <Cellval ok={r.textOk}>{r.text}</Cellval>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Note>
            The vision expert reads the rendered image; the text expert parses
            Nougat-transcribed LaTeX markup. Errors are shown in red.
          </Note>
        </Card>

        <div className="space-y-4">
          <Card>
            <h3 className="text-[14.5px] font-semibold text-ink-950">
              Where each modality breaks
            </h3>
            <ul className="mt-4 space-y-3 text-[13.5px] leading-relaxed text-ink-700">
              <Bullet tone="vision" title="Vision expert">
                Handles layout, merged cells and spanning structure well; drops or
                normalizes math symbols, daggers, subscripts and units.
              </Bullet>
              <Bullet tone="textexp" title="Text expert">
                Preserves fine-grained notation from the LaTeX source; misassigns
                spans when the transcription loses multirow / multicolumn structure.
              </Bullet>
              <Bullet tone="router" title="The gap they leave">
                An oracle that always picks the correct expert per cell sits well
                above both — headroom no single-modality system can reach.
              </Bullet>
            </ul>
          </Card>
          {/* <Card className="bg-ink-950 text-white">
            <p className="text-[13.5px] leading-relaxed text-ink-200">
              &ldquo;Prior work treats these two paradigms as competing
              alternatives; we use this failure as an informative signal.&rdquo;
            </p>
            <p className="mt-3 text-[12px] font-medium text-ink-300">
              &mdash; from the abstract
            </p>
          </Card> */}
        </div>
      </div>
    </Section>
  );
}

function Cellval({ ok, children }) {
  return (
    <td
      className={`px-4 py-3 ${ok ? "text-ink-900" : "font-semibold text-red-600"}`}
    >
      {children}
      {!ok && <span className="ml-2 font-sans text-[11px] font-medium">error</span>}
    </td>
  );
}

function Bullet({ tone, title, children }) {
  const dot = {
    vision: "bg-vision",
    textexp: "bg-textexp",
    router: "bg-router",
  }[tone];
  return (
    <li className="flex gap-3">
      <span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span>
        <span className="font-semibold text-ink-950">{title}. </span>
        {children}
      </span>
    </li>
  );
}

function Framework() {
  return (
    <Section
      className="py-4 sm:py-4"
      eyebrow="The framework"
      title="Two readings, one aligned decision per cell"
      lead="Both experts emit cells in a shared schema. A bipartite alignment step turns two independent readings into a set of decision units, and a lightweight classifier decides which reading to trust for each unit."
    >
      <div className="mt-9">
        {/* <Pipeline /> */}
        <img
          src="/image.png"
          alt="Diagram of the dual-expert routing framework"
          className="p-4 w-full rounded-lg border border-ink-200"
        />
      </div>
      <div className="mt-6">
        <Link
          href="/method"
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-700 hover:underline"
        >
          Read the full method
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 12h15m0 0-5.5-5.5M19 12l-5.5 5.5"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
    </Section>
  );
}

function ResultsTeaser() {
  return (
    <Section
      className="py-16 sm:py-20"
      eyebrow="The result"
      title="A consistent gain"
      lead="Across two datasets and four backbone models, two proprietary (GPT-4o, Gemini 3.1) and two open-weight (Gemma 4, Qwen 3.6), the router improves per-cell extraction accuracy over the stronger single expert in all eight configurations."
    >
      <div className="mt-9">
        <AccuracyChart />
      </div>
      <Note>
        A cell counts as correct only under a strict dual criterion: its span must
        exactly match a ground-truth cell, and its normalized text must match
        exactly (Levenshtein threshold &tau; = 1.0).
      </Note>
    </Section>
  );
}

const APPLICATIONS = [
  {
    title: "Scientific search & retrieval",
    body: "Tables carry the experimental results that abstracts only summarize. Reliable cell-level extraction makes those numbers indexable and queryable at scale.",
  },
  {
    title: "Knowledge base construction",
    body: "Populating structured scientific knowledge bases requires spans and values to be right together, a correct number in the wrong column is still wrong.",
  },
  {
    title: "Automated evidence synthesis",
    body: "Meta-analysis and systematic review pipelines depend on comparative statistics lifted faithfully out of published tables.",
  },
  {
    title: "Digital library infrastructure",
    body: "The framework is backbone agnostic: it wraps whichever pair of models an institution already runs, and improves on both.",
  },
];

function Impact() {
  return (
    <Section
      className="py-16 sm:py-20"
      eyebrow="Why it matters"
      title="Tables are where scientific results actually live"
      lead="Tables embedded in PDF documents remain among the most challenging document elements to extract, and they gate a long list of downstream applications."
    >
      <div className="mt-9 grid gap-4 sm:grid-cols-2">
        {APPLICATIONS.map((a) => (
          <Card key={a.title}>
            <h3 className="text-[14.5px] font-semibold tracking-tight text-ink-950">
              {a.title}
            </h3>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-700">
              {a.body}
            </p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function CallToAction() {
  return (
    <Section className="py-16 sm:py-20">
      <div className="overflow-hidden rounded-2xl bg-ink-950 px-6 py-12 sm:px-12 sm:py-14">
        <div className="max-w-2xl">
          <h2 className="rule-heading text-[26px] font-semibold leading-tight text-white sm:text-[32px]">
            See the router make its decisions, cell by cell
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-300">
            The interactive demo walks through real tables from the A25 benchmark:
            the rendered image, both experts&rsquo; readings, where they disagree,
            and the merged output.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="rounded-lg bg-white px-5 py-3 text-[14.5px] font-semibold text-ink-950 hover:bg-ink-100"
            >
              Open the demo
            </Link>
            <Link
              href="/resources"
              className="rounded-lg border border-ink-700 px-5 py-3 text-[14.5px] font-semibold text-white hover:bg-ink-900"
            >
              Code &amp; data
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Citation() {
  return (
    <Section className="py-12 sm:py-16" eyebrow="Citation" title="Cite this work">
        <Card className="mt-8">
          <pre className="overflow-x-auto rounded-lg bg-ink-950 p-5 font-mono text-[12px] leading-relaxed text-ink-100">
{`@inproceedings{dualexpert2026,
  title     = {A Dual-Expert Routing Framework for Structured
               Data Extraction from Scientific Tables},
  booktitle = {Proceedings of the ACM/IEEE Joint Conference on
               Digital Libraries (JCDL '26)},
  address   = {Dallas, TX, USA},
  year      = {2026}
}`}
          </pre>
          <Note>
            Author and DOI fields are withheld while the submission is under
            anonymous review; this entry will be updated on acceptance.
          </Note>
        </Card>
      </Section>
  )
}
