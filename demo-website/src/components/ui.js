export function Section({ id, eyebrow, title, lead, children, className = "" }) {
  return (
    <section id={id} className={`mx-auto max-w-6xl px-5 sm:px-8 ${className}`}>
      {(eyebrow || title) && (
        <header className="max-w-3xl">
          {eyebrow && (
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-brand-600">
              {eyebrow}
            </p>
          )}
          {title && (
            <h2 className="rule-heading mt-3 text-[27px] font-semibold leading-tight text-ink-950 sm:text-[32px]">
              {title}
            </h2>
          )}
          {lead && (
            <p className="mt-4 text-[15.5px] leading-relaxed text-ink-700">{lead}</p>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

export function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-xl border border-ink-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

const TONES = {
  vision: "bg-vision-soft text-vision ring-vision/20",
  textexp: "bg-textexp-soft text-textexp ring-textexp/20",
  router: "bg-router-soft text-router ring-router/20",
  oracle: "bg-oracle-soft text-oracle ring-oracle/20",
  neutral: "bg-ink-100 text-ink-700 ring-ink-300",
};

export function Pill({ tone = "neutral", children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Stat({ value, unit, label, sub, tone = "neutral" }) {
  const accent = {
    vision: "text-vision",
    textexp: "text-textexp",
    router: "text-router",
    oracle: "text-oracle",
    neutral: "text-ink-950",
  }[tone];
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-5">
      <p className={`rule-heading text-[30px] font-semibold leading-none ${accent}`}>
        {value}
        {unit && (
          <span className="ml-0.5 text-[17px] font-medium text-ink-500">{unit}</span>
        )}
      </p>
      <p className="mt-2.5 text-[13.5px] font-semibold text-ink-900">{label}</p>
      {sub && <p className="mt-1 text-[12.5px] leading-snug text-ink-500">{sub}</p>}
    </div>
  );
}

export function Note({ children }) {
  return (
    <p className="mt-4 border-l-2 border-ink-200 pl-4 text-[12.5px] leading-relaxed text-ink-500">
      {children}
    </p>
  );
}
