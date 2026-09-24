import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import babel from "next/dist/compiled/babel/core.js";
import { buildTableGrid, extractionError } from "./table-grid.mjs";

const cell = (sr, er, sc, ec, text = "value") => ({
  start_row: sr, end_row: er, start_col: sc, end_col: ec, text,
});

test("merged cells occupy their full inclusive spans and leave gaps in position", () => {
  const cells = [cell(1, 1, 2, 2, "tail"), cell(0, 1, 0, 0, "row span"), cell(0, 0, 1, 2, "column span")];
  const rows = buildTableGrid({ n_rows: 2, n_cols: 3, cells });
  assert.deepEqual(rows[0], [cells[1], cells[2]]);
  assert.equal(rows[1].length, 2);
  assert.deepEqual(rows[1][0], { ...cell(1, 1, 1, 1, ""), isGap: true });
  assert.equal(rows[1][1], cells[0]);
});

test("rows covered entirely by a row span are preserved", () => {
  const merged = cell(0, 2, 0, 1);
  assert.deepEqual(buildTableGrid({ n_rows: 3, n_cols: 2, cells: [merged] }), [[merged], [], []]);
});

test("a sparse cell stays in its declared column and row", () => {
  const value = cell(1, 1, 2, 2, "42");
  const rows = buildTableGrid({ n_rows: 2, n_cols: 3, cells: [value] });
  assert.equal(rows[0].length, 3);
  assert.ok(rows[0].every((entry) => entry.isGap));
  assert.equal(rows[1][0].isGap, true);
  assert.equal(rows[1][1].isGap, true);
  assert.equal(rows[1][2], value);
});

test("invalid, oversized, empty, and overlapping predictions fail before rendering", () => {
  for (const table of [
    null,
    { n_rows: 1, n_cols: 1, cells: [] },
    { n_rows: "1", n_cols: 1, cells: [cell(0, 0, 0, 0)] },
    { n_rows: 513, n_cols: 1, cells: [cell(0, 0, 0, 0)] },
    { n_rows: 1, n_cols: 129, cells: [cell(0, 0, 0, 0)] },
    { n_rows: 512, n_cols: 128, cells: [cell(0, 0, 0, 0)] },
    { n_rows: 1, n_cols: 1, cells: [cell(-1, 0, 0, 0)] },
    { n_rows: 1, n_cols: 1, cells: [cell(0, 1, 0, 0)] },
    { n_rows: 2, n_cols: 2, cells: [cell(1, 0, 0, 0)] },
    { n_rows: 1, n_cols: 1, cells: [cell(0, 0, 0, 0, {})] },
    { n_rows: 2, n_cols: 2, cells: [cell(0, 1, 0, 0), cell(1, 1, 0, 1)] },
  ]) {
    assert.throws(() => buildTableGrid(table), /invalid|overlapping/);
  }
});

test("table content is preserved as text and source JSON is not mutated", () => {
  const content = '<img src=x onerror="alert(1)"> & μ\n$5';
  const table = { n_rows: 1, n_cols: 2, cells: [cell(0, 0, 1, 1, content)] };
  const original = structuredClone(table);
  assert.equal(buildTableGrid(table)[0][1].text, content);
  assert.deepEqual(table, original);
});

test("failure messages retain server stages and provide actionable fallback messages", () => {
  assert.match(extractionError({ code: "nougat_failed" }).message, /Nougat.*different image/);
  assert.match(extractionError({ code: "llm_failed" }).message, /language model/);
  assert.deepEqual(extractionError({ code: "llm_failed", stage: "vision", message: "Model unavailable." }), {
    code: "llm_failed", stage: "vision", message: "Model unavailable.",
  });
  assert.equal(typeof extractionError({ message: {} }).message, "string");
  assert.equal(typeof extractionError({ code: "__proto__" }).message, "string");
  assert.equal(typeof extractionError(null).message, "string");
});

test("the HTML renderer preserves spans and escapes model-generated markup", async () => {
  // Compile JSX with the existing compiler so this verifies the real component.
  const sourceUrl = new URL("../components/ExtractedTable.js", import.meta.url);
  const source = await readFile(sourceUrl, "utf8");
  const require = createRequire(sourceUrl);
  const { code } = babel.transformSync(source, {
    filename: "ExtractedTable.jsx", babelrc: false, configFile: false,
    presets: [[require.resolve("next/babel"), { "preset-env": { modules: "commonjs" }, "preset-react": { runtime: "automatic" } }]],
  });
  const component = {};
  new Function("require", "exports", code)(require, component);
  const table = { n_rows: 3, n_cols: 3, cells: [
    cell(0, 2, 0, 0, '<img src=x onerror="alert(1)">'),
    cell(0, 0, 1, 2, "Merged heading"),
    cell(2, 2, 2, 2, "Bottom right"),
  ] };
  const html = renderToStaticMarkup(React.createElement(component.default, {
    table, grid: buildTableGrid(table), filename: "sample.png",
  }));
  assert.match(html, /rowSpan="3"/i);
  assert.match(html, /colSpan="2"/i);
  assert.equal((html.match(/<tr>/g) || []).length, 3);
  assert.match(html, /aria-label="No extracted cell"/);
  assert.match(html, /&lt;img src=x onerror=/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /View extracted JSON/);
});
