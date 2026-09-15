import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-ink-200 bg-ink-50">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-ink-950">
            A Dual-Expert Routing Framework for Structured Data Extraction from
            Scientific Tables
          </h2>
          <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-ink-500">
            Under review at JCDL &rsquo;26 (ACM/IEEE Joint Conference on Digital
            Libraries), Dallas, TX. Code and data released for full
            reproducibility.
          </p>
        </div>

        <nav className="text-[13.5px]">
          <p className="font-semibold text-ink-950">Project</p>
          <ul className="mt-3 space-y-2 text-ink-500">
            <li><Link className="hover:text-brand-700" href="/method">Method</Link></li>
            <li><Link className="hover:text-brand-700" href="/results">Results</Link></li>
            <li><Link className="hover:text-brand-700" href="/demo">Live demo</Link></li>
            <li><Link className="hover:text-brand-700" href="/resources">Data &amp; code</Link></li>
          </ul>
        </nav>

        <nav className="text-[13.5px]">
          <p className="font-semibold text-ink-950">Datasets</p>
          <ul className="mt-3 space-y-2 text-ink-500">
            <li>A25 &mdash; 156 complex tables, 4 domains</li>
            <li>SciTSR &mdash; 157-table complex subset</li>
            <li>4 backbones &times; 2 modalities</li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-ink-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-[12.5px] text-ink-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>&copy; {new Date().getFullYear()} Dual-Expert Table Extraction Project.</p>
          <p className="font-mono">
            Demo build &mdash; live inference backend in progress.
          </p>
        </div>
      </div>
    </footer>
  );
}
