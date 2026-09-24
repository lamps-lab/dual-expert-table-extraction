import io
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from PIL import Image, ImageOps, UnidentifiedImageError

from .errors import ExtractionError
from .experts import Experts
from .nougat import NougatOCR
from .router import TableRouter
from .schema import public_table
from .settings import Settings

logger = logging.getLogger(__name__)
MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000


def decode_image(data):
    try:
        with Image.open(io.BytesIO(data)) as source:
            if source.format not in ("PNG", "JPEG") or source.width * source.height > MAX_IMAGE_PIXELS:
                raise ValueError("Unsupported image size or type.")
            source.load()
            image = ImageOps.exif_transpose(source).convert("RGBA")
            background = Image.new("RGBA", image.size, "white")
            return Image.alpha_composite(background, image).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise ExtractionError("invalid_image", "upload",
            "Choose a valid PNG or JPG table image, up to 8 MB and 20 megapixels.", 400) from None


class ExtractionPipeline:
    def __init__(self, settings=None, ocr=None, experts=None, router=None):
        self.settings = settings or Settings.from_env()
        self.ocr = ocr or NougatOCR(self.settings)
        self.experts = experts or Experts(self.settings)
        self.router = router or TableRouter(self.settings.router_path)

    def extract(self, data, on_progress=None):
        def progress(step, message):
            logger.info(message)
            if on_progress is not None:
                on_progress(step, message)

        if not data or len(data) > MAX_IMAGE_BYTES:
            raise ExtractionError("invalid_image", "upload", "Image must be between 1 byte and 8 MB.", 400)
        
        image = decode_image(data)
        self.settings.validate()
        progress("nougat_started", "Loading Nougat and reading the image…")

        markup = self.ocr.extract(image)
        progress("nougat_complete", "Nougat extraction complete.")
        encoded = io.BytesIO()
        image.save(encoded, format="PNG")

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = {}
            for stage, content in (("vision", encoded.getvalue()), ("text", markup)):
                progress(f"{stage}_started", f"Running {stage} extraction…")
                futures[executor.submit(self.experts.extract, stage, content)] = stage
            cells = {}
            # Report whichever expert finishes first; neither waits for the
            # other's result before its completion reaches the browser.
            for future in as_completed(futures):
                stage = futures[future]
                cells[stage] = future.result()
                progress(f"{stage}_complete", f"{stage.capitalize()} extraction complete.")
            
        try:
            progress("aligning_cells", "Aligning cells and combining expert predictions…")
            routed = self.router.route(cells["vision"], cells["text"])
            progress("finalizing", "Finalizing extraction and preparing the table…")
            table = public_table(routed)
        except Exception:
            logger.exception("Table routing failed")
            raise ExtractionError("router_failed", "router",
                "The expert outputs could not be combined into a table. Please try a different image.", 502) from None
        return {"success": True, "kind": "extraction", "table": table,
                "imageProcessed": True, "message": "Table extracted successfully."}
