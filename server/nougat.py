"""Image-to-markup inference; weights are loaded once, on first extraction."""

import logging
import json
import re
import time

from .errors import ExtractionError
from .gpu import GPU_UNAVAILABLE_MESSAGE, gpu_diagnostics

logger = logging.getLogger(__name__)
NOUGAT_MESSAGE = "Nougat wasn't able to extract this image. Please try a different, clearer table image."


def validate_markup(text):
    if (not isinstance(text, str) or not text.strip()
            or re.search(r"\[MISSING_PAGE[^\]]*\]", text, re.IGNORECASE)
            or not re.search(r"\\begin\{(?:tabular\*?|tabularx|longtable|array)\}", text)):
        raise ExtractionError("nougat_failed", "nougat", NOUGAT_MESSAGE)
    # Reject cut-off tables, including nested math arrays in table cells.
    environments = re.findall(r"\\(begin|end)\{(tabular\*?|tabularx|longtable|array)\}", text)
    stack = []
    for action, environment in environments:
        if action == "begin":
            stack.append(environment)
        elif not stack or stack.pop() != environment:
            raise ExtractionError("nougat_failed", "nougat", NOUGAT_MESSAGE)
    if stack:
        raise ExtractionError("nougat_failed", "nougat", NOUGAT_MESSAGE)
    return text.strip()


class NougatOCR:
    def __init__(self, settings):
        self.settings = settings
        self.model = None
        self.processor = None

    def load(self):
        if self.model is not None:
            return
        import torch
        from transformers import NougatProcessor, VisionEncoderDecoderModel

        if self.settings.nougat_device == "cuda" and not torch.cuda.is_available():
            logger.error("Nougat CUDA initialization failed: %s", json.dumps(gpu_diagnostics()))
            raise ExtractionError("configuration_error", "nougat",
                GPU_UNAVAILABLE_MESSAGE, 503)
        dtype = torch.float16 if self.settings.nougat_device == "cuda" else torch.float32
        processor = NougatProcessor.from_pretrained(self.settings.nougat_model)
        model = VisionEncoderDecoderModel.from_pretrained(
            self.settings.nougat_model, torch_dtype=dtype,
        ).to(self.settings.nougat_device).eval()
        self.processor, self.model = processor, model

    def extract(self, image):
        try:
            self.load()
        except ExtractionError:
            raise
        except Exception:
            logger.exception("Could not load Nougat")
            raise ExtractionError("configuration_error", "nougat",
                "Nougat could not be loaded. Please try again later.", 503) from None

        try:
            import torch
            from transformers import StoppingCriteria, StoppingCriteriaList

            deadline = time.monotonic() + self.settings.nougat_timeout

            class Deadline(StoppingCriteria):
                def __call__(self, input_ids, scores, **kwargs):
                    return time.monotonic() >= deadline

            pixels = self.processor(image, return_tensors="pt").pixel_values
            max_tokens = min(self.settings.nougat_max_tokens,
                             self.model.config.decoder.max_position_embeddings - 1)
            with torch.inference_mode():
                outputs = self.model.generate(
                    pixels.to(self.model.device, dtype=self.model.dtype),
                    min_length=1, max_new_tokens=max_tokens, do_sample=False,
                    # Nougat's config otherwise forces EOS at the length limit,
                    # making an unfinished generation appear complete.
                    forced_eos_token_id=None,
                    bad_words_ids=[[self.processor.tokenizer.unk_token_id]],
                    stopping_criteria=StoppingCriteriaList([Deadline()]),
                )
            # Never return a partial table cut off by length or deadline.
            generated = outputs[0][1:].tolist()
            if self.processor.tokenizer.eos_token_id not in generated:
                raise ExtractionError("nougat_failed", "nougat", NOUGAT_MESSAGE)
            sequence = self.processor.batch_decode(outputs, skip_special_tokens=True)[0]
            return validate_markup(self.processor.post_process_generation(sequence, fix_markdown=False))
        except ExtractionError:
            raise
        except Exception:
            logger.exception("Nougat inference failed")
            raise ExtractionError("nougat_failed", "nougat", NOUGAT_MESSAGE) from None
