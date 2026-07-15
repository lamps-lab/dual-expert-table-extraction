# Dual-Expert Table Extraction

This repo contains the code for our dual-expert table extraction research. We have two "experts" that both try to read a table image from a scientific paper — a **vision expert** (a VLM that looks at the table image) and a **text expert** (an LLM that reads the OCR/text version of the table). They make *different* kinds of mistakes, so we then use a **router** (either a classic ML model or an LLM) to combine their answers into one final table that is better than either expert alone.

We run everything on two datasets: **A25** (tables from 4 domains: Biology, CompSci, ICDAR, MatSci) and **SciTSR** (tables from scientific papers).

## The Data (`data.zip`)

Everything you need to run the notebooks is inside **`data.zip`**. It contains:

- **All the table images and ground truth** from both the **A25** and **SciTSR** datasets.
- **The outputs of all the expert runs** — the cell predictions from every vision and text expert we ran (GPT, Gemini 3.1, Gemma 4, Qwen 3.6), on both datasets. These live in the `outputs/` folders.

## Setting Up the Environment

1. **Python** — we used Python 3.12. Create a virtual environment:

   ```bash
   python3 -m venv env
   source env/bin/activate
   ```

2. **Install the packages** the notebooks use:

   ```bash
   pip install jupyter openai pydantic python-Levenshtein tqdm numpy pandas scikit-learn pillow
   ```

3. **Unzip the data:**

   ```bash
   unzip data.zip
   ```

## What Each File Does (and what you'd change)

### The Experts — these generate the cell predictions

| File | What it does |
|---|---|
| `vision_expert_A25.ipynb` | Vision expert on **A25**. Sends each table *image* to a VLM and asks for the cells (row/col spans + text) as JSON. |
| `text_expert_A25.ipynb` | Text expert on **A25**. Same job, but the model only sees the *text* version of the table (from Nougat OCR), no image. |
| `vision_expert_SciTSR.ipynb` | Vision expert, but for the **SciTSR** dataset. |
| `text_expert_SciTSR.ipynb` | Text expert, but for the **SciTSR** dataset. |

**What you might need to change in these:** they're all set up the same way, so the knobs are at the top of each notebook —
- `VISION_MODEL_NAME` / `MODEL_NAME` — swap in whichever model you want to test.
- `client_2 = OpenAI(...)` — change `base_url` (and `api_key` if you're using a paid API) to point at your model server.
- `DATA_ROOT` — where the images is at.
- `OUT_DIR` — where the predictions of each expert gets saved.

### The Routers — these combine the two experts

| File | What it does |
|---|---|
| `A25_ML_ROUTER.ipynb` | ML router on **A25**. Trains classic ML models (Logistic Regression, SVM, MLP, Random Forest, Gradient Boosting) to pick, cell by cell, whether to trust the vision expert or the text expert. Also computes the **oracle** (a perfect chooser — the ceiling any router could reach). |
| `SciTSR_ML_ROUTER.ipynb` | Same ML router, but on **SciTSR**. |
| `A25_LLM_ROUTER.ipynb` | LLM-as-router on **A25**. Instead of an ML model, it puts *both* experts' full JSON into an LLM prompt and lets the LLM produce the final merged table directly. |
| `SciTSR_LLM_ROUTER.ipynb` | Same LLM router, but on **SciTSR**. |

**What you might need to change in these:**
- `VISION_PRED_ROOT` / `TEXT_PRED_ROOT` — which expert run's outputs to route between. Point these at the folders inside `outputs/` for the expert pair you care about.
- `DATA_ROOT` — where the ground truth lives.
- In the LLM router notebooks: `ROUTER_MODEL_NAME`, the `client` (`api_key` + `base_url` — put in your own key), and `N_FEWSHOT` (how many worked examples go in the prompt).
- `RANDOM_STATE`, `TEST_SIZE`, `VAL_FRACTION` — the train/test split settings. Leave them alone if you want to reproduce our numbers.
