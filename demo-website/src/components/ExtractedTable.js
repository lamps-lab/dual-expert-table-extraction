"use client";

import { useEffect, useState } from "react";

export default function ExtractedTable({ table, grid, filename }) {
  const [downloadUrl, setDownloadUrl] = useState(null);
  const json = JSON.stringify(table, null, 2);

  useEffect(() => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [json]);

  const downloadName = `${(filename || "table").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_") || "table"}.json`;

  return (
    <section className="space-y-4" aria-label="Extraction result">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[14px] font-semibold text-ink-950">Extracted table</h3>
        <p className="text-[12px] text-ink-500">
          {table.n_rows} rows · {table.n_cols} columns · {table.cells.length} cells
        </p>
      </div>
      <div className="max-h-[640px] overflow-auto rounded-lg border border-ink-200" tabIndex={0} aria-label="Extracted table, scroll to see all cells">
        <table className="w-full border-collapse text-[12.5px] text-ink-900">
          <caption className="sr-only">Table extracted from {filename || "the uploaded image"}</caption>
          <tbody>
            {grid.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell) => (
                  <td
                    key={`${cell.start_row}-${cell.start_col}`}
                    rowSpan={cell.end_row - cell.start_row + 1}
                    colSpan={cell.end_col - cell.start_col + 1}
                    aria-label={cell.isGap ? "No extracted cell" : undefined}
                    className={`min-w-12 whitespace-pre-wrap break-words border border-ink-200 px-3 py-2 align-top ${cell.isGap ? "bg-ink-50" : "bg-white"}`}
                  >
                    {cell.text}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-ink-500">
        <p>Review the extracted text against your source image.</p>
        {downloadUrl && (
          <a href={downloadUrl} download={downloadName} className="font-semibold text-brand-700 underline underline-offset-2">
            Download JSON
          </a>
        )}
      </div>
      <details className="rounded-lg border border-ink-200">
        <summary className="cursor-pointer px-4 py-3 text-[13px] font-medium text-ink-900">View extracted JSON</summary>
        <pre className="max-h-96 overflow-auto border-t border-ink-200 bg-ink-50 p-4 text-[12px] text-ink-700">{json}</pre>
      </details>
    </section>
  );
}
