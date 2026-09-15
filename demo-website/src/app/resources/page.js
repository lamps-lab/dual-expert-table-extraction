import { Section, Card, Note, Pill } from "@/components/ui";

export const metadata = {
  title: "Resources",
  description:
    "Code, data, reproduction instructions and citation for the dual-expert routing framework.",
};

const ARTIFACTS = [
  {
    name: "Expert notebooks",
    files: [
      "vision_expert_A25.ipynb",
      "text_expert_A25.ipynb",
      "vision_expert_SciTSR.ipynb",
      "text_expert_SciTSR.ipynb",
    ],
    body: "Run a vision or text expert over a dataset and write per-table cell predictions as JSON. The backbone, endpoint and output directory are set at the top of each notebook.",
  },
  {
    name: "Router notebooks",
    files: [
      "A25_ML_ROUTER.ipynb",
      "SciTSR_ML_ROUTER.ipynb",
      "A25_LLM_ROUTER.ipynb",
      "SciTSR_LLM_ROUTER.ipynb",
    ],
    body: "Align two expert runs into decision units, train the five router families, and compute the router, oracle and single-expert accuracies reported in the paper.",
  },
  {
    name: "Analysis notebooks",
    files: [
      "data_analysis.ipynb",
      "complementary_error_analysis.ipynb",
      "clean_data.ipynb",
    ],
    body: "Dataset statistics, the complementary-error breakdown behind the motivating examples, and the ground-truth cleaning pipeline.",
  },
];

export default function ResourcesPage() {
  return (
    <>
      <div className="border-b border-ink-200 bg-ink-50">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-brand-600">
            Reproducibility
          </p>
          <h1 className="rule-heading mt-3 max-w-3xl text-[34px] font-semibold leading-tight text-ink-950 sm:text-[42px]">
            Code, data and every expert run we report
          </h1>
          <p className="mt-5 max-w-2xl text-[15.5px] leading-relaxed text-ink-700">
            The release ships the table images and ground truth for both
            datasets, plus the raw cell predictions from all sixteen expert runs, 
            four backbones &times; two modalities &times; two datasets,
            so every number on this site can be recomputed without
            re-running a single model.
          </p>
        </div>
      </div>

      <Section className="py-12 sm:py-14">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <Pill tone="neutral">Repository</Pill>
            <h2 className="mt-3 text-[14.5px] font-semibold text-ink-950">
              Source code
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-700">
              Notebooks for the experts, the routers and the analysis, released
              under anonymous review at 4open.science.
            </p>
            <a
              href="https://anonymous.4open.science/r/dual-expert-table-extraction-9B60"
              className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-700 hover:underline"
            >
              Browse the repository
              <Arrow />
            </a>
          </Card>
          <Card>
            <Pill tone="neutral">Data</Pill>
            <h2 className="mt-3 text-[14.5px] font-semibold text-ink-950">
              Images, ground truth &amp; runs
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-700">
              A single <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[12px]">data.zip</code> containing
              A25 and SciTSR inputs and every expert run under{" "}
              <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[12px]">outputs/</code>.
            </p>
          </Card>
          <Card>
            <Pill tone="neutral">Paper</Pill>
            <h2 className="mt-3 text-[14.5px] font-semibold text-ink-950">
              JCDL &rsquo;26 submission
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-700">
              Full method, evaluation protocol and related work, including the
              LLM-arbiter comparison.
            </p>
            <a
              href="/paper.pdf"
              className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-700 hover:underline"
            >
              Read the PDF
              <Arrow />
            </a>
          </Card>
        </div>
      </Section>

      <Section
        className="py-12 sm:py-14"
        eyebrow="What is in the release"
        title="Three groups of notebooks"
      >
        <div className="mt-8 space-y-4">
          {ARTIFACTS.map((a) => (
            <Card key={a.name}>
              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <div>
                  <h3 className="text-[14.5px] font-semibold text-ink-950">
                    {a.name}
                  </h3>
                  <ul className="mt-2.5 space-y-1">
                    {a.files.map((f) => (
                      <li key={f} className="font-mono text-[11.5px] text-ink-500">
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-[13.5px] leading-relaxed text-ink-700">
                  {a.body}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section className="py-12 sm:py-14" eyebrow="Getting started" title="Reproducing the reported numbers">
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <p className="text-[13px] font-semibold text-ink-950">Environment</p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-ink-950 p-4 font-mono text-[12px] leading-relaxed text-ink-100">
{`python3 -m venv env
source env/bin/activate

pip install jupyter openai pydantic \\
    python-Levenshtein tqdm numpy \\
    pandas scikit-learn pillow

unzip data.zip`}
            </pre>
            <Note>Developed and tested on Python 3.12.</Note>
          </Card>
          <Card>
            <p className="text-[13px] font-semibold text-ink-950">Workflow</p>
            <ol className="mt-4 space-y-3 text-[13.5px] leading-relaxed text-ink-700">
              <li>
                <span className="font-semibold text-ink-950">1. </span>
                Point <code className="font-mono text-[12px]">DATA_ROOT</code> at
                the unzipped inputs and pick a backbone in an expert notebook, or
                skip ahead and use the shipped predictions.
              </li>
              <li>
                <span className="font-semibold text-ink-950">2. </span>
                In a router notebook, set{" "}
                <code className="font-mono text-[12px]">VISION_PRED_ROOT</code> and{" "}
                <code className="font-mono text-[12px]">TEXT_PRED_ROOT</code> to
                the expert pair you want to route between.
              </li>
              <li>
                <span className="font-semibold text-ink-950">3. </span>
                Leave{" "}
                <code className="font-mono text-[12px]">RANDOM_STATE</code>,{" "}
                <code className="font-mono text-[12px]">TEST_SIZE</code> and{" "}
                <code className="font-mono text-[12px]">VAL_FRACTION</code>{" "}
                untouched to reproduce the published split.
              </li>
              <li>
                <span className="font-semibold text-ink-950">4. </span>
                Run the notebook end to end; it prints the single-expert, router
                and oracle accuracies for that configuration.
              </li>
            </ol>
          </Card>
        </div>
      </Section>

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
    </>
  );
}

function Arrow() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 17 17 7M17 7H9M17 7v8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
