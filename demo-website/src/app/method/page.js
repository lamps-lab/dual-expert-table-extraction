import Pipeline from "@/components/Pipeline";
import { Section, Card, Pill, Note } from "@/components/ui";
import { FEATURE_GROUPS } from "@/data/results";

export const metadata = {
  title: "Method",
  description:
    "Cell schema, dual perception, Hungarian alignment on grid-IoU, per-cell routing features, and the strict evaluation criterion.",
};

export default function MethodPage() {
  return (
    <>
      <PageHeader />
      <Overview />
      <Schema />
      <Alignment />
      <Routing />
      <Evaluation />
    </>
  );
}

function PageHeader() {
  return (
    <div className="border-b border-ink-200 bg-ink-50">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-brand-600">
          Methodology
        </p>
        <h1 className="rule-heading mt-3 max-w-3xl text-[34px] font-semibold leading-tight text-ink-950 sm:text-[42px]">
          Structured extraction as a per-cell classification problem between two
          complementary experts
        </h1>
        <p className="mt-5 max-w-2xl text-[15.5px] leading-relaxed text-ink-700">
          Given a table image, a vision expert and a text expert independently
          generate structured table representations. A lightweight router then
          determines, at the cell level, which expert&rsquo;s prediction should be
          trusted.
        </p>
      </div>
    </div>
  );
}

function Overview() {
  return (
    <Section className="py-8 sm:py-16" eyebrow="The framework">
      {/* <Pipeline compact /> */}

      <img
          src="/image.png"
          alt="Diagram of the dual-expert routing framework"
          className="mt-4 p-4 w-full rounded-lg border border-ink-200"
        />
    </Section>
  );
}

function Schema() {
  return (
    <Section
      className="py-14 sm:py-16"
      eyebrow="Step 1"
      title="A shared cell schema for both modalities"
      lead="To compare the two experts directly, both produce output in a common cell-based schema built on a grid system where rows and columns are indexed from zero."
    >
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.05fr]">
        <Card>
          <p className="text-[13px] font-semibold text-ink-950">Cell tuple</p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-ink-950 p-4 font-mono text-[12.5px] leading-relaxed text-ink-100">
{`(sr, er, sc, ec, text)

sr, er   start / end row      → vertical span
sc, ec   start / end column   → horizontal span
text     extracted cell content`}
          </pre>
          <Note>
            Both experts are decoded deterministically at temperature zero to
            ensure reproducible outputs.
          </Note>
        </Card>

        <div className="space-y-4">
          <Card>
            <Pill tone="vision">Vision expert</Pill>
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink-700">
              A vision language model extracts table cells directly from the
              image. The model is constrained to generate outputs conforming to
              the predefined cell schema, so structural and textual information
              is produced in a single step.
            </p>
          </Card>
          <Card>
            <Pill tone="textexp">Text expert</Pill>
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink-700">
              A two stage pipeline: the table image is first converted to LaTeX
              markup with Nougat, then a large language model parses that markup
              into the same cell schema. Few shot in context examples cover
              multirow and multicolumn spans, mathematical expressions and Greek
              symbols.
            </p>
          </Card>
        </div>
      </div>
    </Section>
  );
}

function Alignment() {
  return (
    <Section
      className="py-14 sm:py-16"
      eyebrow="Step 2"
      title="Turning two readings into decision units"
      lead="Both experts emit the same schema, but they frequently disagree about structure, one may predict a spanning cell where the other splits the same region into multiple cells. Cells therefore cannot be compared by row and column index alone."
    >
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <ol className="space-y-5">
            <Step n="1" title="Score every candidate pair">
              For each pair of cells <Mono>(v, t)</Mono>, spatial overlap is
              measured as intersection-over-union of the two table footprints on
              the grid.
            </Step>
            <Step n="2" title="Break ties on content">
              Normalized Levenshtein similarity between cell contents acts as a
              secondary signal among overlapping candidates.
            </Step>
            <Step n="3" title="Solve one-to-one assignment">
              The Hungarian algorithm produces a globally optimal matching; pairs
              whose IoU falls below a threshold are discarded and treated as
              unmatched.
            </Step>
            <Step n="4" title="Emit decision units">
              The result is a set of units of the form <Mono>(v, t)</Mono>,{" "}
              <Mono>(v, &empty;)</Mono>, or <Mono>(&empty;, t)</Mono>, matched
              pairs plus cells only one expert produced.
            </Step>
          </ol>
          <Note>
            The alignment procedure is identical during training and inference,
            so the router never sees a pairing it could not reproduce at test
            time.
          </Note>
        </Card>

        <Card className="bg-ink-50">
          <p className="text-[13px] font-semibold text-ink-950">
            Why alignment is the crux
          </p>
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-700">
            A router can only choose between two predictions if it knows which
            two predictions describe the same region of the table. Structural
            disagreement is exactly the case where routing is most valuable and
            where naive index-based pairing breaks down.
          </p>
          <div className="mt-5 space-y-2.5">
            <UnitRow label="(v, t)" desc="Both experts describe the region" tone="router" />
            <UnitRow label="(v, ∅)" desc="Only the vision expert emitted a cell here." tone="vision" />
            <UnitRow label="(∅, t)" desc="Only the text expert emitted a cell here." tone="textexp" />
          </div>
        </Card>
      </div>
    </Section>
  );
}

function UnitRow({ label, desc, tone }) {
  const bar = { vision: "bg-vision", textexp: "bg-textexp", router: "bg-router" }[tone];
  return (
    <div className="flex items-start gap-3 rounded-lg border border-ink-200 bg-white p-3">
      <span className={`mt-1 h-4 w-1 shrink-0 rounded-full ${bar}`} />
      <div>
        <p className="font-mono text-[12.5px] font-semibold text-ink-950">{label}</p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-ink-500">{desc}</p>
      </div>
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <li className="flex gap-4">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-[12px] font-semibold text-brand-700">
        {n}
      </span>
      <span>
        <span className="block text-[13.5px] font-semibold text-ink-950">{title}</span>
        <span className="mt-1 block text-[13.5px] leading-relaxed text-ink-700">
          {children}
        </span>
      </span>
    </li>
  );
}

function Mono({ children }) {
  return (
    <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[12px] text-ink-900">
      {children}
    </code>
  );
}

function Routing() {
  return (
    <Section
      className="py-14 sm:py-16"
      eyebrow="Step 3"
      title="A lightweight classifier over cell-level features"
      lead="Each decision unit is evaluated by a routing model that predicts which expert's extraction is more likely to be correct. The router is built using features derived solely from the experts' predictions, never from ground truth, so it runs unchanged at inference time."
    >
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {FEATURE_GROUPS.map((g) => (
          <Card key={g.name}>
            <Pill tone={g.tone}>{g.name} features</Pill>
            <ul className="mt-4 space-y-2 text-[13px] leading-relaxed text-ink-700">
              {g.items.map((it) => (
                <li key={it} className="flex gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-300" />
                  {it}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="text-[14.5px] font-semibold tracking-tight text-ink-950">
            Training on disagreement only
          </h3>
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-700">
            The router is trained only on disagreement cases: units where the two
            experts produce different predictions and exactly one prediction
            matches the ground truth. These examples provide explicit supervision
            about which expert should be trusted. Selected cells are then
            recombined into the final table extraction.
          </p>
        </Card>
        <Card>
          <h3 className="text-[14.5px] font-semibold tracking-tight text-ink-950">
            Router families compared
          </h3>
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-700">
            Five feature-based models: Random Forest, Gradient Boosting,
            Multi-Layer Perceptron, Logistic Regression and an RBF-kernel SVM. Plus two LLM arbiters (GLM 5.2 and GPT 5.6) that receive both
            experts&rsquo; JSON in-prompt and emit the merged table directly. The
            tree ensemble wins: despite their far greater capacity, both LLM
            arbiters trail the Random Forest in most configurations.
          </p>
        </Card>
      </div>
    </Section>
  );
}

function Evaluation() {
  return (
    <Section
      className="py-14 sm:py-16"
      eyebrow="Step 4"
      title="A deliberately strict correctness criterion"
      lead="A predicted cell is deemed correct if and only if it satisfies a strict dual criterion — the span must exactly match a ground-truth cell, and the normalized textual content must match exactly."
    >
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <p className="text-[13px] font-semibold text-ink-950">
            Textual agreement
          </p>
          {/* <pre className="mt-3 overflow-x-auto rounded-lg bg-ink-950 p-4 font-mono text-[12.5px] leading-relaxed text-ink-100">
{`Lev_Accuracy(gt, pred)
    = 1 −  Levenshtein(gt, pred)
           ─────────────────────
           max(len(gt), len(pred))

threshold τ = 1.0  → exact match required`}
          </pre> */}
          <img
            src="/equation.png"
            className="mt-3 p-4 w-full rounded-lg border border-ink-200"
          />
          <pre className="mt-3 overflow-x-auto rounded-lg bg-ink-950/60 p-4 font-mono text-[12.5px] leading-relaxed text-ink-100">
{`threshold τ = 1.0  → exact match required`}
          </pre>

          <Note>
            Applied after standard normalization (whitespace stripping, Unicode
            math symbol alignment).
          </Note>
        </Card>

        <Card>
          <p className="text-[13px] font-semibold text-ink-950">
            Reported metrics
          </p>
          <dl className="mt-4 space-y-4 text-[13.5px] leading-relaxed">
            <div>
              <dt className="font-semibold text-ink-950">Single expert</dt>
              <dd className="text-ink-700">
                Standalone accuracy of an individual expert.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink-950">Router</dt>
              <dd className="text-ink-700">
                Accuracy of the full dual-modality system.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink-950">Oracle</dt>
              <dd className="text-ink-700">
                Ceiling of an optimal selector that picks the correct expert
                whenever either is right.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink-950">Gain</dt>
              <dd className="text-ink-700">
                Absolute percentage-point improvement of the router over the
                stronger of the two single modalities.
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card className="mt-6">
        <h3 className="text-[14.5px] font-semibold tracking-tight text-ink-950">
          Splits and leakage control
        </h3>
        <p className="mt-3 max-w-4xl text-[13.5px] leading-relaxed text-ink-700">
          Neither dataset ships a split suitable for this setting, so we
          partition both ourselves under a strict table level criterion, 
          all cells of a table land in the same fold, using a
          60/15/25 train/validation/test split. Every reported number is computed
          on the held out test tables only.
        </p>
      </Card>
    </Section>
  );
}
