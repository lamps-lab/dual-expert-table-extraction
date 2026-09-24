# Dual-Expert Table Extraction

This repo contains the code for our dual-expert table extraction research. We have two "experts" that both try to read a table image from a scientific paper — a **vision expert** (a VLM that looks at the table image) and a **text expert** (an LLM that reads the OCR/text version of the table). They make *different* kinds of mistakes, so we then use a **router** (either a classic ML model or an LLM) to combine their answers into one final table that is better than either expert alone.

We run everything on two datasets: **A25** (tables from 4 domains: Biology, CompSci, ICDAR, MatSci) and **SciTSR** (tables from scientific papers).

## Live upload demo

The live demo connects image uploads to Nougat on a GPU, vision and text experts at `https://llm.cs.odu.edu/v1`, and the exported A25 Random Forest router. It returns structured table JSON and renders the extracted table in the frontend, including merged cells. Nougat and model failures are reported separately.

The worker loads `server/.env` from its Docker image; use [the environment example](server/.env.example) for model settings. The controller forwards stored images to one shared GPU worker, processes uploads sequentially, and keeps the pod and loaded Nougat model ready for **five minutes after each run**. Each subsequent run resets that idle timer. The controller deletes the pod after the idle window, even when no new upload arrives. Set `GPU_IDLE_TIMEOUT_SECONDS` on the controller to change the default `300` seconds.

During extraction, the progress bar follows real stage events: Nougat reading, vision and text extraction (each reports completion independently), cell alignment, and finalization. Elapsed time keeps updating while a stage runs. Progress reflects completed stages rather than an estimate of time remaining. The worker streams these events to the controller, which persists them for the frontend's reconnectable event stream; the existing JSON-only extraction API remains available.

The **Test GPU startup** button checks CUDA initialization and a small GPU calculation. HTTP readiness (`/health`) is separate from CUDA diagnostics (`/diagnostics/gpu`). The worker image includes GKE's `/usr/local/nvidia/lib64` driver path so PyTorch can find `libcuda.so.1`. Worker failures are logged before cleanup; the frontend receives the error message or a successful table immediately.

Use the gateway's served model ID, `gemma-4-31b`, in `LLM_MODEL`. The Hugging Face checkpoint name `google/gemma-4-31b-it` is not the ODU gateway ID and was rejected with HTTP 403. Expert failures log the HTTP status and configured model without logging credentials or provider response bodies.

Run one controller replica with the `Recreate` deployment strategy. Its Redis worker record preserves the idle deadline across controller restarts. Idle cleanup depends on that controller being running. Rebuild and deploy the worker and controller together when changing their API; the worker image still embeds `.env` and the router artifact.

### Rebuild and deploy the demo

Run these commands from the repository root after updating `server/.env`:

```sh
TABLE_REGISTRY=us-central1-docker.pkg.dev/app-prana-odu/demo-app-dual-expert

docker buildx build --platform linux/amd64 --push -t "$TABLE_REGISTRY/gpu-server:v1" ./server
docker buildx build --platform linux/amd64 --push -t "$TABLE_REGISTRY/job-controller:v1" ./controller
docker buildx build --platform linux/amd64 --push -t "$TABLE_REGISTRY/table-extraction-demo:latest" ./demo-website

kubectl -n default apply -f controller/job-spawner-rbac.yaml
kubectl -n default apply -f controller/job-controller.yaml
kubectl -n default apply -f demo-website/deployment.yaml
kubectl -n default rollout restart deployment/job-controller deployment/table-extraction-demo
kubectl -n default rollout status deployment/job-controller --timeout=10m
kubectl -n default rollout status deployment/table-extraction-demo --timeout=10m

node scripts/demo-proxy.mjs
```

The controller and GPU worker always pull their configured image. When using the same mutable tag for a later GPU rebuild, allow the current worker's five-minute idle window to expire so the next run creates a pod using the new image. View progress and retained failure diagnostics with `kubectl -n default logs -f deployment/job-controller`.

### Open the deployed demo locally

From the repository root, run `node scripts/demo-proxy.mjs`, then open **http://127.0.0.1:3000/demo**. Keep that terminal open; Ctrl+C stops the helper and its child `kubectl proxy`. Stop any existing port-forward on port 3000 first, or choose another local port with `node scripts/demo-proxy.mjs 3001`. Node and an authenticated `kubectl` are the only requirements; no npm install, image rebuild, or deployment update is needed.

The helper uses the [Kubernetes HTTP service proxy](https://kubernetes.io/docs/tasks/access-application-cluster/access-cluster-services/) to reach the existing `default/table-extraction-demo` service. It restores normal website URLs after Kubernetes' HTML URL rewriting and streams uploads and progress events. It binds only to your computer's loopback address and uses your current kubectl context.

This provides an alternative when `kubectl port-forward` exits with `broken pipe` followed by `lost connection to pod`. A dead local tunnel produces `Failed to fetch` even while the frontend pod is healthy; similar connection-reset handling is tracked in [containerd #9875](https://github.com/containerd/containerd/issues/9875). A failed upload is not retried automatically because its response may have been lost after the job was accepted.

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
