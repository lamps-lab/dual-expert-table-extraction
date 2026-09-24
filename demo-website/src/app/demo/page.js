import DemoExplorer from "@/components/DemoExplorer";
import UploadDemo from "@/components/UploadDemo";
import samples from "@/data/samples.json";
import { Section, Card, Note } from "@/components/ui";

export const metadata = {
  title: "Live Demo",
  description:
    "Extract table images into structured JSON and HTML tables, then explore the vision and text experts on A25 benchmark examples.",
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
            Extract a table from your image
          </h1>
          <p className="mt-5 max-w-2xl text-[15.5px] leading-relaxed text-ink-700">
            Upload a cropped table image. Nougat reads its text, the vision and
            text experts extract its cells, and the trained router combines
            their predictions into a table you can review and download as JSON.
          </p>
        </div>
      </div>

      <Section className="py-10 sm:py-14">
        <Card>
          <h2 className="text-[18px] font-semibold tracking-tight text-ink-950">
            Run it on your own table
          </h2>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-700">
            Choose a clear PNG or JPG image with one table and follow its live
            progress. The result includes an HTML table and the extracted JSON.
          </p>
          <UploadDemo />
        </Card>
      </Section>

      <Section className="py-6 sm:py-10">
        <h2 className="rule-heading text-[26px] font-semibold text-ink-950">Explore benchmark examples</h2>
        <p className="mb-6 mt-3 max-w-3xl text-[14px] leading-relaxed text-ink-700">
          These saved A25 examples compare the Gemma 4 vision and text experts
          with human annotations. Select a cell to inspect both readings. Their
          benchmark scores are separate from your live extraction above.
        </p>
        <DemoExplorer samples={samples} />
        <div className="mt-6">
          <Card>
            <h2 className="text-[14.5px] font-semibold tracking-tight text-ink-950">
              How to read the benchmark examples
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
                &mdash; these saved examples use the oracle choice: the correct
                expert wherever either was right. Your uploaded table uses the
                trained router instead.
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
