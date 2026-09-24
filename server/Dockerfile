FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 HF_HOME=/opt/models

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake Nougat into the image so each disposable GPU pod avoids downloading it.
# NOUGAT_MODEL can also point at another pre-cached model directory at runtime.
ARG NOUGAT_MODEL=facebook/nougat-base
RUN python -c "from transformers import NougatProcessor, VisionEncoderDecoderModel; NougatProcessor.from_pretrained('${NOUGAT_MODEL}'); VisionEncoderDecoderModel.from_pretrained('${NOUGAT_MODEL}')"

COPY *.py ./server/
COPY artifacts/ ./server/artifacts/
# The worker loads this baked configuration through python-dotenv.
COPY .env ./server/.env

# GKE mounts host NVIDIA drivers here. python:slim does not include these paths,
# so CUDA cannot find libcuda.so.1 even when a GPU was allocated successfully.
ENV LD_LIBRARY_PATH=/usr/local/nvidia/lib64:/usr/local/nvidia/lib
ENV PATH=/usr/local/nvidia/bin:${PATH}

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]
