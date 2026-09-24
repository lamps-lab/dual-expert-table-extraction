import os
import math
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

from .errors import ExtractionError

ENV_FILE = Path(__file__).with_name(".env")


@dataclass(frozen=True)
class Settings:
    # ODU's served model ID for the Gemma expert pair used by the router.
    vision_model: str = "gemma-4-31b"
    text_model: str = "gemma-4-31b"
    vision_base_url: str = "https://llm.cs.odu.edu/v1"
    text_base_url: str = "https://llm.cs.odu.edu/v1"
    vision_api_key: str = field(default="", repr=False)
    text_api_key: str = field(default="", repr=False)
    llm_timeout: float = 180
    llm_max_tokens: int = 16384
    response_format: str = "json_schema"
    disable_thinking: bool = False
    nougat_model: str = "facebook/nougat-base"
    nougat_device: str = "cuda"
    nougat_max_tokens: int = 4095
    nougat_timeout: float = 240
    router_path: str = str(Path(__file__).parent / "artifacts/router_a25.joblib")

    @classmethod
    def from_env(cls):
        # Docker copies this file next to the worker code. The explicit path
        # also makes local runs independent of the shell's working directory.
        load_dotenv(ENV_FILE, override=False)
        base_url = os.getenv("LLM_BASE_URL", cls.vision_base_url)
        key = os.getenv("LLM_API_KEY", "")
        model = os.getenv("LLM_MODEL", cls.vision_model)
        return cls(
            vision_model=os.getenv("VISION_MODEL", model),
            text_model=os.getenv("TEXT_MODEL", model),
            vision_base_url=os.getenv("VISION_BASE_URL", base_url),
            text_base_url=os.getenv("TEXT_BASE_URL", base_url),
            vision_api_key=os.getenv("VISION_API_KEY", key),
            text_api_key=os.getenv("TEXT_API_KEY", key),
            llm_timeout=float(os.getenv("LLM_TIMEOUT_SECONDS", "180")),
            llm_max_tokens=int(os.getenv("LLM_MAX_TOKENS", "16384")),
            response_format=os.getenv("LLM_RESPONSE_FORMAT", "json_schema"),
            disable_thinking=os.getenv("LLM_DISABLE_THINKING", "false").lower() == "true",
            nougat_model=os.getenv("NOUGAT_MODEL", "facebook/nougat-base"),
            nougat_device=os.getenv("NOUGAT_DEVICE", "cuda"),
            nougat_max_tokens=int(os.getenv("NOUGAT_MAX_TOKENS", "4095")),
            nougat_timeout=float(os.getenv("NOUGAT_TIMEOUT_SECONDS", "240")),
            router_path=os.getenv("ROUTER_PATH", cls.router_path),
        )

    def validate(self):
        from urllib.parse import urlparse

        for stage in ("vision", "text"):
            endpoint = urlparse(getattr(self, f"{stage}_base_url"))
            if endpoint.scheme not in ("http", "https") or not endpoint.netloc or not getattr(self, f"{stage}_model"):
                raise ExtractionError("configuration_error", stage,
                    "The extraction model service is not configured. Please contact the demo administrator.", 503)
            if endpoint.hostname == "llm.cs.odu.edu" and not getattr(self, f"{stage}_api_key"):
                raise ExtractionError("configuration_error", stage,
                    "The ODU LLM gateway API key is not configured. Please contact the demo administrator.", 503)
        if (self.response_format not in ("json_schema", "json_object", "none")
                or not all(math.isfinite(value) for value in (self.llm_timeout, self.nougat_timeout))
                or min(self.llm_timeout, self.nougat_timeout, self.llm_max_tokens, self.nougat_max_tokens) <= 0
                or self.nougat_device not in ("cuda", "cpu")):
            raise ExtractionError("configuration_error", "configuration",
                "The extraction service settings are invalid. Please contact the demo administrator.", 503)
