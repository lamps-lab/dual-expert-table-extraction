class ExtractionError(Exception):
    """An error safe to return to the upload UI."""

    def __init__(self, code, stage, message, status_code=422):
        super().__init__(message)
        self.code = code
        self.stage = stage
        self.message = message
        self.status_code = status_code

    def payload(self):
        return {"error": {"code": self.code, "stage": self.stage, "message": self.message}}
