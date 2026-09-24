const MAX_ROWS = 512;
const MAX_COLUMNS = 128;
const MAX_GRID_SLOTS = 16384;
const MAX_CELLS = 2000;

/** Build HTML table rows while preserving inclusive spans and missing cells. */
export function buildTableGrid(table) {
  const { n_rows: rowCount, n_cols: columnCount, cells } = table ?? {};
  if (![rowCount, columnCount].every((value) => Number.isSafeInteger(value) && value > 0)
    || rowCount > MAX_ROWS || columnCount > MAX_COLUMNS
    || rowCount * columnCount > MAX_GRID_SLOTS || !Array.isArray(cells) || cells.length === 0
    || cells.length > rowCount * columnCount || cells.length > MAX_CELLS) {
    throw new Error("The extraction returned an invalid table. Please try again.");
  }

  const occupied = Array.from({ length: rowCount }, () => Array(columnCount).fill(null));
  for (const cell of cells) {
    const { start_row: sr, end_row: er, start_col: sc, end_col: ec, text } = cell ?? {};
    if (![sr, er, sc, ec].every((value) => Number.isSafeInteger(value) && value >= 0)
      || sr > er || sc > ec || er >= rowCount || ec >= columnCount || typeof text !== "string") {
      throw new Error("The extraction returned invalid table cells. Please try again.");
    }
    for (let row = sr; row <= er; row += 1) {
      for (let column = sc; column <= ec; column += 1) {
        if (occupied[row][column]) {
          throw new Error("The extraction returned overlapping table cells. Please try a clearer image.");
        }
        occupied[row][column] = cell;
      }
    }
  }

  return occupied.map((row, rowIndex) => row.flatMap((cell, columnIndex) => {
    if (cell === null) {
      return [{
        start_row: rowIndex, end_row: rowIndex, start_col: columnIndex, end_col: columnIndex,
        text: "", isGap: true,
      }];
    }
    return cell.start_row === rowIndex && cell.start_col === columnIndex ? [cell] : [];
  }));
}

export function extractionError(data) {
  const fallback = {
    nougat_failed: "Nougat could not extract this table image. Please try a clearer or different image.",
    llm_failed: "The language model could not extract the table. Please try again.",
    router_failed: "The table predictions could not be combined. Please try again.",
    invalid_image: "This image could not be read. Choose a valid PNG or JPG image.",
  };
  const code = typeof data?.code === "string" ? data.code : null;
  const fallbackMessage = Object.hasOwn(fallback, code) ? fallback[code] : "Table extraction failed. Please try again.";
  return {
    message: typeof data?.message === "string" && data.message.trim()
      ? data.message : fallbackMessage,
    code,
    stage: typeof data?.stage === "string" ? data.stage : null,
  };
}
