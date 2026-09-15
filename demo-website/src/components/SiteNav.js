"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/method", label: "Method" },
  { href: "/results", label: "Results" },
  { href: "/demo", label: "Live Demo" },
  { href: "/resources", label: "Resources" },
];

export default function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-ink-200/80 bg-white/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5 sm:px-8">
        <Link href="/" className="group flex items-center gap-2.5">
          <GridMark />
          <span className="flex flex-col leading-none">
            <span className="text-[13px] font-semibold tracking-tight text-ink-950">
              Dual-Expert Routing
            </span>
            <span className="mt-0.5 text-[11px] font-medium text-ink-500">
              Scientific Table Extraction
            </span>
          </span>
        </Link>

        <div className="ml-auto hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors ${
                isActive(l.href)
                  ? "bg-brand-50 text-brand-700"
                  : "text-ink-700 hover:bg-ink-50 hover:text-ink-950"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <a
            href="/paper.pdf"
            className="ml-2 inline-flex items-center gap-1.5 rounded-md bg-ink-950 px-3.5 py-2 text-[13.5px] font-medium text-white transition-colors hover:bg-ink-900"
          >
            Paper
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M7 17 17 7M17 7H9M17 7v8"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation"
          className="ml-auto rounded-md p-2 text-ink-700 hover:bg-ink-50 md:hidden"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </nav>

      {open && (
        <div className="border-t border-ink-200 bg-white px-5 py-3 md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`block rounded-md px-3 py-2.5 text-sm font-medium ${
                isActive(l.href) ? "bg-brand-50 text-brand-700" : "text-ink-700"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}

function GridMark() {
  return (
    <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-950">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="white" strokeWidth="1.8" />
        <path d="M3 9.5h18M9.5 9.5V20" stroke="white" strokeWidth="1.8" />
        <rect x="12" y="12" width="6" height="5" rx="1" fill="#818cf8" />
      </svg>
    </span>
  );
}
