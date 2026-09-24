import json
import logging
import queue
import threading
from functools import lru_cache

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse
from starlette.concurrency import run_in_threadpool

from .errors import ExtractionError
from .gpu import gpu_diagnostics
from .pipeline import ExtractionPipeline, MAX_IMAGE_BYTES

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
app = FastAPI(title="Dual-expert table extraction")
inference_lock = threading.Lock()


@lru_cache(maxsize=1)
def get_pipeline():
    return ExtractionPipeline()


@app.exception_handler(ExtractionError)
async def extraction_error(request, error):
    return JSONResponse(error.payload(), status_code=error.status_code)


@app.get("/", response_class=PlainTextResponse)
async def hello():
    return "Hello World"


@app.get("/health")
async def health():
    # Process readiness. Model loading/failures belong to the extraction request.
    return {"status": "ok"}


@app.get("/diagnostics/gpu")
async def check_gpu():
    details = await run_in_threadpool(gpu_diagnostics)
    if not details["cuda_available"]:
        logger.error("GPU diagnostic failed: %s", details)
    return JSONResponse(details, status_code=200 if details["cuda_available"] else 503)


def run_extraction(data, on_progress=None):
    # One inference at a time per GPU; health probes remain responsive.
    if not inference_lock.acquire(blocking=False):
        raise ExtractionError("worker_busy", "worker", "The GPU is busy. Please try again shortly.", 503)
    try:
        pipeline = get_pipeline()
        return (pipeline.extract(data, on_progress=on_progress)
                if on_progress is not None else pipeline.extract(data))
    except ExtractionError:
        raise
    except Exception:
        logger.exception("Unexpected extraction failure")
        raise ExtractionError("extraction_failed", "worker",
            "Table extraction failed. Please try again later.", 500) from None
    finally:
        inference_lock.release()


def extraction_events(data):
    """Stream bounded stage events while inference owns the GPU lock.

    A disconnected controller stops consuming this generator, but inference
    keeps its lock until it finishes so recovery cannot start overlapping work.
    """
    events = queue.SimpleQueue()

    def progress(step, message):
        events.put({"event": "status", "data": {"step": step, "message": message}})

    def run():
        try:
            result = run_extraction(data, on_progress=progress)
            events.put({"event": "complete", "data": {"result": result}})
        except ExtractionError as error:
            events.put({"event": "failed", "status_code": error.status_code,
                        "data": error.payload()["error"]})

    threading.Thread(target=run, name="table-extraction", daemon=True).start()
    while True:
        try:
            event = events.get(timeout=10)
        except queue.Empty:
            event = {"event": "heartbeat"}
        yield json.dumps(event) + "\n"
        if event["event"] in ("complete", "failed"):
            return


@app.post("/extract")
async def extract(request: Request):
    if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() not in ("image/png", "image/jpeg"):
        raise ExtractionError("invalid_image", "upload", "Send a PNG or JPG image as the request body.", 415)
    image = bytearray()
    async for chunk in request.stream():
        image.extend(chunk)
        if len(image) > MAX_IMAGE_BYTES:
            raise ExtractionError("invalid_image", "upload", "Image must be at most 8 MB.", 413)
    if not image:
        raise ExtractionError("invalid_image", "upload", "The uploaded image is empty.", 400)
    if "application/x-ndjson" in request.headers.get("accept", ""):
        return StreamingResponse(extraction_events(bytes(image)), media_type="application/x-ndjson",
                                 headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"})
    return await run_in_threadpool(run_extraction, bytes(image))
