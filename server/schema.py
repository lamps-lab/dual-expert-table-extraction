import json
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, model_validator

MAX_ROWS = 512
MAX_COLS = 128
MAX_GRID_SIZE = 16384
MAX_CELLS = 2000


class Cell(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    sr: Annotated[int, Field(ge=0, lt=MAX_ROWS)]
    er: Annotated[int, Field(ge=0, lt=MAX_ROWS)]
    sc: Annotated[int, Field(ge=0, lt=MAX_COLS)]
    ec: Annotated[int, Field(ge=0, lt=MAX_COLS)]
    text: Annotated[str, Field(max_length=20000)]

    @model_validator(mode="after")
    def ordered_span(self):
        if self.er < self.sr or self.ec < self.sc:
            raise ValueError("Cell spans must have inclusive, ordered bounds.")
        return self


class CellTable(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    cells: Annotated[list[Cell], Field(min_length=1, max_length=MAX_CELLS)]

    @model_validator(mode="after")
    def bounded_grid(self):
        rows = max(c.er for c in self.cells) + 1
        cols = max(c.ec for c in self.cells) + 1
        if rows * cols > MAX_GRID_SIZE:
            raise ValueError("Table grid is too large.")
        return self


def parse_cells(content):
    # Accept a single fenced JSON block, but never silently salvage partial JSON.
    if not isinstance(content, str):
        raise ValueError("The model did not return text.")
    content = content.strip()
    if content.startswith("```") and content.endswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return [cell.model_dump() for cell in CellTable.model_validate(json.loads(content)).cells]


def public_table(cells):
    table = CellTable.model_validate({"cells": cells})
    occupied = set()
    output = []
    for c in sorted(table.cells, key=lambda c: (c.sr, c.sc, c.er, c.ec)):
        positions = {(r, col) for r in range(c.sr, c.er + 1) for col in range(c.sc, c.ec + 1)}
        if occupied & positions:
            raise ValueError("Routed cells overlap.")
        occupied.update(positions)
        output.append({"start_row": c.sr, "end_row": c.er, "start_col": c.sc, "end_col": c.ec, "text": c.text})
    return {"cells": output, "n_rows": max(c.er for c in table.cells) + 1,
            "n_cols": max(c.ec for c in table.cells) + 1}
