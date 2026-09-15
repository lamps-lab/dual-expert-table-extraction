import DemoExplorer from "@/components/DemoExplorer";
import UploadDemo from "@/components/UploadDemo";
import samples from "@/data/samples.json";
import { Section, Card, Note } from "@/components/ui";

export const metadata = {
  title: "Live Demo",
  description:
    "Explore real A25 tables cell by cell: the rendered image, the vision expert's reading, the text expert's reading, where they disagree, and the merged output.",
};

export default function DemoPage() {
  return (
    <>
      <div className="border-b border-ink-200 bg-ink-50">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-brand-600">
            Interactive demo
          </p>
          <h1 className="rule-heading mt-3 max-w-3xl text-[34px] font-semibold leading-tight text-ink-950 sm:text-[42px]">
            Watch two experts disagree, cell by cell
          </h1>
          <p className="mt-5 max-w-2xl text-[15.5px] leading-relaxed text-ink-700">
            Each example below is a real table from the A25 benchmark, with the
            actual cell predictions from a Gemma 4 vision expert and a Gemma 4
            text expert, scored against the human ground-truth annotation. Click
            any cell to inspect the two readings side by side.
          </p>
        </div>
      </div>

      <Section className="py-10 sm:py-14">
        <DemoExplorer samples={samples} />
      </Section>

      <Section className="py-6 sm:py-10">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h2 className="text-[14.5px] font-semibold tracking-tight text-ink-950">
              Run it on your own table
            </h2>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-700">
              Upload a cropped table image to start a GPU pod and watch live
              progress. This checks the server is reachable; extraction is coming
              later, and your image is retained.
            </p>
            <UploadDemo />
          </Card>

          <Card>
            <h2 className="text-[14.5px] font-semibold tracking-tight text-ink-950">
              How to read this demo
            </h2>
            <ul className="mt-4 space-y-3 text-[13.5px] leading-relaxed text-ink-700">
              <li>
                <span className="font-semibold text-ink-950">Ground truth</span>{" "}
                &mdash; the human annotation, rendered from the benchmark XML.
              </li>
              <li>
                <span className="font-semibold text-ink-950">Expert views</span>{" "}
                &mdash; each expert&rsquo;s own text for that cell, marked correct
                only when both its span and its normalized text match exactly.
              </li>
              <li>
                <span className="font-semibold text-ink-950">Complementarity map</span>{" "}
                &mdash; colors the table by which expert was right, making the
                routable cells visible at a glance.
              </li>
              <li>
                <span className="font-semibold text-ink-950">Routed output</span>{" "}
                &mdash; the merged table. In this static build the selection is
                the oracle choice, standing in for the trained router until the
                live inference service is connected.
              </li>
            </ul>
            <Note>
              Accuracies shown per example are computed on that single table and
              are illustrative; the aggregate benchmark numbers are on the
              Results page.
            </Note>
          </Card>
        </div>
      </Section>
    </>
  );
}
