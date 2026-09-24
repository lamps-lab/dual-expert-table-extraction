import base64
import logging

import httpx

from .errors import ExtractionError
from .prompts import TEXT_PROMPT, VISION_PROMPT
from .schema import CellTable, parse_cells

logger = logging.getLogger(__name__)


class Experts:
    def __init__(self, settings, transport=None):
        self.settings = settings
        self.transport = transport

    def extract(self, stage, content):
        settings = self.settings
        user_content = content
        if stage == "vision":
            encoded = base64.b64encode(content).decode("ascii")
            user_content = [
                {"type": "text", "text": "Extract the table cells from this image as JSON."},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{encoded}"}},
            ]
        body = {
            "model": getattr(settings, f"{stage}_model"),
            "messages": [
                {"role": "system", "content": VISION_PROMPT if stage == "vision" else TEXT_PROMPT},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0.0, 
            "top_p": 0.95, 
            "max_tokens": settings.llm_max_tokens,
        }

        if settings.response_format == "json_schema":
            body["response_format"] = {
                    "type": "json_schema", 
                    "json_schema": {
                    "name": "cell_info", "schema": CellTable.model_json_schema(),
                }
            }
        elif settings.response_format == "json_object":
            body["response_format"] = {
                "type": "json_object"
            }

        if settings.disable_thinking:
            body["chat_template_kwargs"] = {"enable_thinking": False}
            
        key = getattr(settings, f"{stage}_api_key")
        headers = {"Authorization": f"Bearer {key}"} if key else {}
        endpoint = getattr(settings, f"{stage}_base_url").rstrip("/") + "/chat/completions"
        try:
            with httpx.Client(timeout=httpx.Timeout(settings.llm_timeout, connect=10),
                              transport=self.transport) as client:
                response = client.post(endpoint, headers=headers, json=body)
                response.raise_for_status()
            choice = response.json()["choices"][0]
            if choice.get("finish_reason") != "stop" or choice["message"].get("refusal"):
                raise ValueError("Model response was incomplete or refused.")
            return parse_cells(choice["message"].get("content"))
        except Exception as error:
            # Provider responses may contain credentials/input; never echo them.
            if isinstance(error, httpx.HTTPStatusError):
                logger.warning("%s expert failed (%s; HTTP %d; model=%r)",
                               stage, type(error).__name__, error.response.status_code, body["model"])
            else:
                logger.warning("%s expert failed (%s)", stage, type(error).__name__)
            raise ExtractionError("llm_failed", stage,
                f"The {stage} LLM couldn't extract the table. Please try again later.", 502) from None
