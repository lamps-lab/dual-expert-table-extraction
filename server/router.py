"""Inference for the A25 cell router exported from A25_ML_ROUTER.ipynb.

Only feature computation normalizes text. Returned cells retain their original
contents, including capitalization and mathematical symbols.
"""

from __future__ import annotations

import math
from pathlib import Path
from threading import Lock
import unicodedata


DEFAULT_ARTIFACT = Path(__file__).parent / "artifacts" / "router_a25.joblib"
MIN_IOU = 0.9
MATCH_TEXT_WEIGHT = 0.5


def normalize_text(text):
    if text is None:
        return ""
    # Canonical normalization preserves Unicode number categories (for example,
    # fractions and Roman numerals) without character-specific substitutions.
    text = unicodedata.normalize("NFC", str(text).casefold())
    return " ".join(text.split())


def lev_sim(a, b):
    import Levenshtein

    a, b = normalize_text(a), normalize_text(b)
    if a == "" and b == "":
        return 1.0
    return 1.0 - Levenshtein.distance(a, b) / max(len(a), len(b), 1)


def has_symbol(text):
    """Use Unicode's symbol categories, independent of script or code point."""
    return any(unicodedata.category(char).startswith("S") for char in normalize_text(text))


def is_numeric(text):
    """Recognize numbers with punctuation, spacing, math, or currency symbols.

    Unicode categories distinguish letters and pictographs from numeric content;
    there are no character allowlists or markup-specific exceptions.
    """
    categories = [unicodedata.category(char) for char in normalize_text(text)]
    return any(category.startswith("N") for category in categories) and all(
        category.startswith(("N", "P", "Z")) or category in ("Sm", "Sc")
        for category in categories
    )


def safe_text(cell):
    return "" if cell is None else normalize_text(cell.get("text", ""))


def span_rows(cell):
    return 0 if cell is None else int(cell["er"]) - int(cell["sr"]) + 1


def span_cols(cell):
    return 0 if cell is None else int(cell["ec"]) - int(cell["sc"]) + 1


def router_features(vision, text):
    """The 21 feature columns, using Unicode-based text classification."""
    vt, tt = safe_text(vision), safe_text(text)
    vr, vc, tr, tc = span_rows(vision), span_cols(vision), span_rows(text), span_cols(text)
    return {
        "vision_missing": vision is None,
        "text_missing": text is None,
        "one_missing": (vision is None) != (text is None),
        "vision_len": len(vt),
        "text_len": len(tt),
        "len_diff": abs(len(vt) - len(tt)),
        "vision_empty": vt == "",
        "text_empty": tt == "",
        "empty_mismatch": (vt == "") != (tt == ""),
        "same_text": vt == tt,
        "agent_similarity": lev_sim(vt, tt),
        "vision_numeric": is_numeric(vt),
        "text_numeric": is_numeric(tt),
        "numeric_mismatch": is_numeric(vt) != is_numeric(tt),
        "vision_symbol": has_symbol(vt),
        "text_symbol": has_symbol(tt),
        "symbol_mismatch": has_symbol(vt) != has_symbol(tt),
        "row_span_diff": abs(vr - tr),
        "col_span_diff": abs(vc - tc),
        "vision_merged": (vr > 1) or (vc > 1),
        "text_merged": (tr > 1) or (tc > 1),
    }


# Keep imports lightweight: the GPU health endpoint need not import the ML stack.
FEATURES = (
    "vision_missing", "text_missing", "one_missing", "vision_len", "text_len",
    "len_diff", "vision_empty", "text_empty", "empty_mismatch", "same_text",
    "agent_similarity", "vision_numeric", "text_numeric", "numeric_mismatch",
    "vision_symbol", "text_symbol", "symbol_mismatch", "row_span_diff",
    "col_span_diff", "vision_merged", "text_merged",
)


def agent_iou(vision, text):
    """Intersection over union of inclusive row/column spans."""
    if vision is None or text is None:
        return 0.0
    inter_r = min(vision["er"], text["er"]) - max(vision["sr"], text["sr"]) + 1
    inter_c = min(vision["ec"], text["ec"]) - max(vision["sc"], text["sc"]) + 1
    if inter_r <= 0 or inter_c <= 0:
        return 0.0
    inter = inter_r * inter_c
    area_v = span_rows(vision) * span_cols(vision)
    area_t = span_rows(text) * span_cols(text)
    return inter / (area_v + area_t - inter)


def match_agents(vision_cells, text_cells, min_iou=MIN_IOU, text_weight=MATCH_TEXT_WEIGHT):
    """Reproduce the notebook's Hungarian matching and unmatched singletons."""
    import numpy as np
    from scipy.optimize import linear_sum_assignment

    if not vision_cells or not text_cells:
        return [(vision, None) for vision in vision_cells] + [(None, text) for text in text_cells]
    iou = np.array([[agent_iou(vision, text) for text in text_cells] for vision in vision_cells])
    scores = iou.copy()
    if text_weight:
        for i, vision in enumerate(vision_cells):
            for j, text in enumerate(text_cells):
                if iou[i, j] > 0:
                    scores[i, j] += text_weight * lev_sim(vision["text"], text["text"])
    vision_indexes, text_indexes = linear_sum_assignment(-scores)
    units, used_vision, used_text = [], set(), set()
    for i, j in zip(vision_indexes, text_indexes):
        if iou[i, j] >= min_iou:
            units.append((vision_cells[i], text_cells[j]))
            used_vision.add(i)
            used_text.add(j)
    units += [(vision_cells[i], None) for i in range(len(vision_cells)) if i not in used_vision]
    units += [(None, text_cells[j]) for j in range(len(text_cells)) if j not in used_text]
    return units


def _non_overlapping(candidates):
    """Keep complete original cells; highest selected-expert confidence wins.

    The research evaluation can count overlapping predictions independently.
    HTML cannot render those spans faithfully, so production discards conflicting
    lower-confidence cells. Equal confidence retains alignment order. It never
    splits spans or invents replacement content.
    """
    kept, occupied = [], set()
    for confidence, order, cell in sorted(candidates, key=lambda item: (-item[0], item[1])):
        footprint = {
            (row, col)
            for row in range(cell["sr"], cell["er"] + 1)
            for col in range(cell["sc"], cell["ec"] + 1)
        }
        if occupied.isdisjoint(footprint):
            occupied.update(footprint)
            kept.append(dict(cell))
    return sorted(kept, key=lambda cell: (cell["sr"], cell["sc"], cell["er"], cell["ec"]))


class TableRouter:
    def __init__(self, path=DEFAULT_ARTIFACT):
        self.path = Path(path)
        self._bundle = None
        self._load_lock = Lock()

    def _load(self):
        if self._bundle is not None:
            return self._bundle
        with self._load_lock:
            if self._bundle is not None:
                return self._bundle
            import joblib
            import sklearn

            # This is a repository-owned artifact, never an uploaded pickle.
            bundle = joblib.load(self.path)
            if not isinstance(bundle, dict) or "model" not in bundle:
                raise ValueError("The router artifact must contain a model bundle.")
            if tuple(bundle.get("features", ())) != FEATURES:
                raise ValueError("The router artifact's feature order does not match this implementation.")
            if bundle.get("positive_label") != "vision":
                raise ValueError("The router artifact must use vision as the positive class.")
            threshold = bundle.get("threshold")
            if not isinstance(threshold, (int, float)) or not math.isfinite(threshold) or not 0 <= threshold <= 1:
                raise ValueError("The router artifact has an invalid decision threshold.")
            model = bundle["model"]
            if not callable(getattr(model, "predict_proba", None)):
                raise ValueError("The router model must provide class probabilities.")
            if list(getattr(model, "classes_", ())) != [0, 1]:
                raise ValueError("The router model's classes must be [0, 1].")
            if tuple(getattr(model, "feature_names_in_", ())) != FEATURES:
                raise ValueError("The router model's feature names do not match its metadata.")
            if getattr(model, "n_features_in_", None) != len(FEATURES):
                raise ValueError("The router model has an incompatible feature count.")
            metadata = bundle.get("meta", {})
            trained_version = metadata.get("sklearn_version")
            if trained_version and trained_version != sklearn.__version__:
                raise RuntimeError(
                    f"The router requires scikit-learn {trained_version}; installed version is {sklearn.__version__}."
                )
            alignment = metadata.get("alignment", {})
            min_iou = alignment.get("MIN_IOU", MIN_IOU)
            text_weight = alignment.get("MATCH_TEXT_WEIGHT", MATCH_TEXT_WEIGHT)
            if not isinstance(min_iou, (int, float)) or not math.isfinite(min_iou) or not 0 <= min_iou <= 1:
                raise ValueError("The router artifact has an invalid alignment IoU.")
            if not isinstance(text_weight, (int, float)) or not math.isfinite(text_weight) or text_weight < 0:
                raise ValueError("The router artifact has an invalid text matching weight.")
            self._bundle = bundle
        return self._bundle

    def route(self, vision_cells: list[dict], text_cells: list[dict]) -> list[dict]:
        """Route validated cells, retaining the notebook's missing-expert drops."""
        if not vision_cells and not text_cells:
            return []
        import numpy as np
        import pandas as pd

        bundle = self._load()
        alignment = bundle.get("meta", {}).get("alignment", {})
        units = match_agents(
            vision_cells, text_cells,
            min_iou=alignment.get("MIN_IOU", MIN_IOU),
            text_weight=alignment.get("MATCH_TEXT_WEIGHT", MATCH_TEXT_WEIGHT),
        )
        frame = pd.DataFrame([router_features(vision, text) for vision, text in units], columns=FEATURES).astype(float)
        probabilities = np.asarray(bundle["model"].predict_proba(frame))
        if probabilities.shape != (len(units), 2) or not np.isfinite(probabilities).all():
            raise RuntimeError("The router returned invalid probabilities.")
        if ((probabilities < 0) | (probabilities > 1)).any():
            raise RuntimeError("The router returned probabilities outside [0, 1].")
        candidates = []
        for order, ((vision, text), probability) in enumerate(zip(units, probabilities[:, 1])):
            pick_vision = probability >= bundle["threshold"]
            cell = vision if pick_vision else text
            if cell is not None:
                candidates.append((float(probability if pick_vision else 1 - probability), order, cell))
        return _non_overlapping(candidates)
