import json
import logging
import os
import time
from http.client import HTTPConnection, HTTPException
from uuid import UUID

import redis
from kubernetes import client, config
from kubernetes.client.exceptions import ApiException

QUEUE = "table-demo:queue"
GROUP = "gpu-controller"
CONSUMER = "controller"
API_TIMEOUT = (5, 20)
MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_RESPONSE_BYTES = 4 * 1024 * 1024
WORKER_KEY = "table-demo:gpu-worker"


class JobError(Exception):
    def __init__(self, code, stage, message):
        super().__init__(message)
        self.code, self.stage, self.message = code, stage, message

    def as_dict(self):
        return {"code": self.code, "stage": self.stage, "message": self.message}


def request_worker(address, path, *, deadline, data=None, content_type=None,
                   max_bytes=MAX_RESPONSE_BYTES, on_status=None):
    """Make one bounded request; the deadline also covers slow response bodies."""
    connection = HTTPConnection(address, 8000)
    transport = None
    response = None

    def remaining():
        seconds = deadline - time.monotonic()
        if seconds <= 0:
            raise TimeoutError("GPU request deadline elapsed.")
        connection.timeout = seconds
        if transport is not None:
            transport.settimeout(seconds)
        return seconds

    try:
        connection.timeout = min(5, remaining())
        connection.connect()
        transport = connection.sock
        remaining()
        headers = {"Content-Type": content_type} if content_type else {}
        if on_status is not None:
            headers["Accept"] = "application/x-ndjson"
        connection.request("POST" if data is not None else "GET", path, body=data, headers=headers)
        remaining()
        response = connection.getresponse()
        response_type = response.getheader("Content-Type", "")
        streaming = isinstance(response_type, str) and response_type.split(";", 1)[0].strip().lower() == "application/x-ndjson"
        chunks, length = [], 0
        pending, terminal, seen_steps = b"", None, set()

        def consume_event(line):
            nonlocal terminal
            if not line.strip():
                return
            if terminal is not None:
                raise JobError("invalid_response", "response", "The GPU server sent data after its final result.")
            try:
                event = json.loads(line)
            except (ValueError, UnicodeDecodeError) as error:
                raise JobError("invalid_response", "response", "The GPU server returned unreadable extraction progress.") from error
            if not isinstance(event, dict):
                raise JobError("invalid_response", "response", "The GPU server returned invalid extraction progress.")
            kind, payload = event.get("event"), event.get("data")
            if kind == "heartbeat":
                return
            if kind == "status" and isinstance(payload, dict) and all(
                    isinstance(payload.get(key), str) and payload[key] for key in ("step", "message")):
                if payload["step"] not in seen_steps:
                    if on_status is not None:
                        on_status({"step": payload["step"], "message": payload["message"]})
                    seen_steps.add(payload["step"])
                return
            if kind == "complete" and isinstance(payload, dict) and isinstance(payload.get("result"), dict):
                terminal = (200, json.dumps(payload["result"]).encode())
                return
            if kind == "failed" and isinstance(payload, dict) and all(
                    isinstance(payload.get(key), str) and payload[key] for key in ("code", "stage", "message")):
                status = event.get("status_code", 502)
                if type(status) is int and 400 <= status <= 599:
                    terminal = (status, json.dumps({"error": payload}).encode())
                    return
            raise JobError("invalid_response", "response", "The GPU server returned invalid extraction progress.")

        def finish():
            if not streaming:
                return response.status, b"".join(chunks)
            if pending.strip():
                consume_event(pending)
            if terminal is None:
                raise JobError("invalid_response", "response", "The GPU server disconnected before returning the table result.")
            return terminal

        while True:
            remaining()
            chunk = response.read1(min(64 * 1024, max_bytes + 1 - length))
            if not chunk:
                return finish()
            length += len(chunk)
            if length > max_bytes:
                raise JobError("invalid_response", "response", "The GPU server returned an oversized response.")
            if streaming:
                pending += chunk
                while b"\n" in pending:
                    line, pending = pending.split(b"\n", 1)
                    consume_event(line)
            else:
                chunks.append(chunk)
            if response.isclosed():
                return finish()
    finally:
        if response is not None:
            response.close()
        connection.close()


class Controller:
    def __init__(self, store, api, image, namespace="default", gpu_type="nvidia-l4",
                 timeout=600, poll_seconds=2, cleanup_timeout=90, extraction_timeout=600,
                 cpu_request="2", memory_request="8Gi", memory_limit="16Gi", gpu_idle_timeout=300):
        self.store, self.api, self.image = store, api, image
        self.namespace, self.gpu_type = namespace, gpu_type
        self.timeout, self.poll_seconds = timeout, poll_seconds
        self.cleanup_timeout, self.extraction_timeout = cleanup_timeout, extraction_timeout
        self.cpu_request, self.memory_request, self.memory_limit = cpu_request, memory_request, memory_limit
        if gpu_idle_timeout <= 0:
            raise ValueError("GPU_IDLE_TIMEOUT_SECONDS must be greater than zero.")
        self.gpu_idle_timeout = gpu_idle_timeout

    def save(self, job, event=None, data=None, worker=None):
        key = f"table-demo:job:{job['id']}"
        with self.store.pipeline(transaction=True) as pipe:
            pipe.set(key, json.dumps(job))
            if worker is not None:
                pipe.set(WORKER_KEY, json.dumps(worker))
            if event:
                pipe.rpush(f"{key}:events", json.dumps({"event": event, "data": data}))
            pipe.execute()

    def worker(self):
        raw = self.store.get(WORKER_KEY)
        return json.loads(raw) if raw else None

    def save_worker(self, worker):
        with self.store.pipeline(transaction=True) as pipe:
            if worker is None:
                pipe.delete(WORKER_KEY)
            else:
                pipe.set(WORKER_KEY, json.dumps(worker))
            pipe.execute()

    def status(self, job, step, message):
        if step not in job.setdefault("steps", []):
            job["steps"].append(step)
            self.save(job, "status", {"step": step, "message": message})
            logging.info("Job %s: %s", job["id"], message)

    def read_pod(self, name):
        try:
            return self.api.read_namespaced_pod(name, self.namespace, _request_timeout=API_TIMEOUT)
        except ApiException as error:
            if error.status == 404:
                return None
            raise

    def ensure_pod(self, job):
        name = job["podName"]
        if self.read_pod(name) is not None:
            return
        pod = client.V1Pod(
            metadata=client.V1ObjectMeta(name=name, namespace=self.namespace,
                labels={"app": "table-gpu-worker"}),
            spec=client.V1PodSpec(
                restart_policy="Never",
                automount_service_account_token=False,
                termination_grace_period_seconds=10,
                node_selector={"cloud.google.com/gke-accelerator": self.gpu_type},
                containers=[client.V1Container(
                    name="gpu-workload", image=self.image, image_pull_policy="Always",
                    ports=[client.V1ContainerPort(container_port=8000)],
                    resources=client.V1ResourceRequirements(
                        requests={"cpu": self.cpu_request, "memory": self.memory_request, "nvidia.com/gpu": "1"},
                        limits={"memory": self.memory_limit, "nvidia.com/gpu": "1"},
                    ),
                    readiness_probe=client.V1Probe(
                        http_get=client.V1HTTPGetAction(path="/health", port=8000), period_seconds=2,
                    ),
                )],
            ),
        )
        try:
            self.api.create_namespaced_pod(self.namespace, pod, _request_timeout=API_TIMEOUT)
        except ApiException as error:
            if error.status != 409:
                raise

    def wait_for_server(self, job):
        # Once readiness was persisted, recovery may use the remaining extraction window.
        deadline = job["startedAt"] + self.timeout
        if job.get("backendReadyAt"):
            deadline += self.extraction_timeout
        while time.time() < deadline:
            pod = self.read_pod(job["podName"])
            if pod is None:
                raise JobError("startup_failed", "startup", "The GPU pod disappeared before extraction could finish.")
            if pod.status.phase in ("Failed", "Succeeded"):
                raise JobError("startup_failed", "startup", "The GPU pod exited before the server was ready.")
            if pod.status.phase == "Running":
                self.status(job, "pod_running", "GPU pod is running.")
                if pod.status.pod_ip:
                    try:
                        status, body = request_worker(
                            pod.status.pod_ip, "/health",
                            deadline=time.monotonic() + min(5, deadline - time.time()), max_bytes=1024,
                        )
                        if status == 200 and json.loads(body).get("status") == "ok":
                            job.setdefault("backendReadyAt", time.time())
                            self.status(job, "backend_ready", "GPU server is ready.")
                            return pod.status.pod_ip
                    except (HTTPException, TimeoutError, OSError, ValueError, AttributeError):
                        pass  # Running does not necessarily mean Uvicorn is ready yet.
            time.sleep(min(self.poll_seconds, max(0, deadline - time.time())))
        raise JobError("startup_timeout", "startup", f"GPU server was not ready within {self.timeout} seconds.")

    def extract(self, job, address):
        image = self.store.get(f"table-demo:job:{job['id']}:image")
        if not isinstance(image, bytes) or not image or len(image) > MAX_IMAGE_BYTES:
            raise JobError("invalid_image", "input", "The uploaded image is missing or invalid. Upload a PNG or JPG up to 8 MB.")
        content_type = job.get("contentType")
        if content_type not in ("image/png", "image/jpeg"):
            raise JobError("invalid_image", "input", "Choose a PNG or JPG image.")
        job.setdefault("extractionStartedAt", time.time())
        self.status(job, "extracting", "Extracting the table with Nougat, both experts, and the router…")
        # Persist timing even when the status already exists after a controller restart.
        self.save(job)
        seconds = min(
            job["startedAt"] + self.timeout + self.extraction_timeout,
            job["extractionStartedAt"] + self.extraction_timeout,
        ) - time.time()
        deadline = time.monotonic() + seconds
        while True:
            try:
                if time.monotonic() >= deadline:
                    raise TimeoutError("GPU extraction deadline elapsed.")
                status, body = request_worker(address, "/extract", deadline=deadline,
                                              data=image, content_type=content_type,
                                              on_status=lambda update: self.status(job, update["step"], update["message"]))
            except TimeoutError as error:
                raise JobError("extraction_timeout", "extraction", "Table extraction timed out. Please try again.") from error
            except (HTTPException, OSError) as error:
                raise JobError("worker_unavailable", "extraction", "The GPU server stopped responding during extraction. Please try again.") from error
            try:
                payload = json.loads(body)
            except (ValueError, UnicodeDecodeError) as error:
                raise JobError("invalid_response", "response", "The GPU server returned an unreadable extraction response.") from error
            if not isinstance(payload, dict):
                raise JobError("invalid_response", "response", "The GPU server returned an invalid extraction response.")
            failure = payload.get("error")
            if status != 503 or not isinstance(failure, dict) or failure.get("code") != "worker_busy":
                break
            # After a controller restart the original POST can still be running.
            # Keep its pod and wait within the original extraction deadline. The
            # inference may run again after it unlocks; completed results are not
            # cached by the worker, so recovery provides at-least-once execution.
            logging.info("Job %s: previous extraction still running; waiting for the GPU worker", job["id"])
            time.sleep(min(self.poll_seconds, max(0, deadline - time.monotonic())))
        if not 200 <= status < 300:
            error = payload.get("error")
            if isinstance(error, dict) and all(isinstance(error.get(key), str) and error[key] for key in ("code", "stage", "message")):
                raise JobError(error["code"], error["stage"], error["message"])
            raise JobError("extraction_failed", "extraction", "The GPU server could not extract this table. Please try another image.")
        table = payload.get("table")
        if (payload.get("success") is not True or payload.get("kind") != "extraction"
                or payload.get("imageProcessed") is not True or not isinstance(table, dict)
                or not isinstance(table.get("cells"), list) or not table["cells"]
                or any(type(table.get(key)) is not int or table[key] < 1 for key in ("n_rows", "n_cols"))):
            raise JobError("invalid_response", "response", "The GPU server returned an invalid table result.")
        return payload

    def startup_test(self, job, address):
        self.status(job, "gpu_testing", "Checking that CUDA can run on the GPU…")
        seconds = job["startedAt"] + self.timeout + self.extraction_timeout - time.time()
        try:
            status, body = request_worker(address, "/diagnostics/gpu", deadline=time.monotonic() + seconds,
                                          max_bytes=16 * 1024)
            diagnostics = json.loads(body)
        except (HTTPException, TimeoutError, OSError, ValueError) as error:
            raise JobError("startup_failed", "startup", "The GPU CUDA test could not finish. Please try again.") from error
        if status != 200 or not isinstance(diagnostics, dict) or diagnostics.get("cuda_available") is not True:
            logging.error("GPU CUDA test failed for job %s: %s", job["id"], diagnostics)
            raise JobError("configuration_error", "nougat", "The Nougat GPU is unavailable. Please try again later.")
        return {"success": True, "kind": "startup_test", "response": "CUDA is available", "imageProcessed": False,
                "gpu": {key: diagnostics[key] for key in ("torch_version", "cuda_runtime", "device_count", "devices")
                        if key in diagnostics},
                "imageRetained": True, "message": "GPU CUDA test passed. Image retained; extraction has not run."}

    def cleanup(self, name):
        try:
            self.api.delete_namespaced_pod(name, self.namespace, _request_timeout=API_TIMEOUT)
        except ApiException as error:
            if error.status == 404:
                return
            raise
        deadline = time.monotonic() + self.cleanup_timeout
        while time.monotonic() < deadline:
            if self.read_pod(name) is None:
                return
            time.sleep(self.poll_seconds)
        raise TimeoutError(f"Waiting for GPU pod {name} to be deleted; cleanup will be retried.")

    def log_worker_failure(self, name, job_id):
        """Keep bounded diagnostics in controller logs, never in the browser result."""
        try:
            pod = self.read_pod(name)
            if pod is not None:
                logging.error("GPU pod %s for job %s: phase=%s reason=%s containers=%s",
                              name, job_id, pod.status.phase, pod.status.reason,
                              getattr(pod.status, "container_statuses", None))
            logs = self.api.read_namespaced_pod_log(
                name, self.namespace, container="gpu-workload", tail_lines=80,
                limit_bytes=12000, timestamps=True, _request_timeout=API_TIMEOUT,
            )
            logging.error("GPU worker logs for job %s (%s):\n%s", job_id, name, logs)
        except Exception:
            logging.warning("Could not read GPU diagnostics for %s", name, exc_info=True)

    @staticmethod
    def unusable_worker(error):
        return (error.stage == "startup" or error.code in {
            "startup_failed", "startup_timeout", "worker_unavailable", "worker_busy",
            "extraction_timeout", "invalid_response", "job_failed", "gpu_unavailable",
        } or (error.code == "configuration_error" and error.stage in {"nougat", "worker"}))

    def maintain_worker(self):
        """Called even with an empty queue; a running job is never an idle worker."""
        worker = self.worker()
        if not worker or worker["state"] == "busy":
            return
        if worker["state"] == "idle" and worker["idleUntil"] > time.time() and worker["image"] == self.image:
            return
        # Persist deletion intent so a crash during cleanup cannot revive this pod.
        worker["state"] = "discard"
        self.save_worker(worker)
        self.cleanup(worker["podName"])
        self.save_worker(None)
        logging.info("GPU pod %s removed after idle expiry or worker failure", worker["podName"])

    def acquire_worker(self, job):
        worker = self.worker()
        if worker and (worker["state"] == "discard" or worker["image"] != self.image):
            worker["state"] = "discard"
            self.save_worker(worker)
            self.maintain_worker()
            worker = None
        if worker and worker["state"] == "busy" and worker["jobId"] != job["id"]:
            # The controller must remain a single serial consumer. Do not steal work.
            raise RuntimeError("Another job owns the shared GPU worker.")
        reused = bool(worker and worker["state"] == "idle")
        if reused:
            pod = self.read_pod(worker["podName"])
            if pod is None or pod.status.phase in ("Failed", "Succeeded"):
                self.log_worker_failure(worker["podName"], job["id"])
                worker["state"] = "discard"
                self.save_worker(worker)
                self.maintain_worker()
                worker, reused = None, False
        if worker is None:
            worker = {"podName": job.get("podName", f"table-gpu-{job['id']}"), "image": self.image}
        worker.update(state="busy", jobId=job["id"])
        worker.pop("idleUntil", None)
        job["podName"] = worker["podName"]
        job["state"] = "running"
        # Claiming the pod and persisting the job are one transaction. The pending
        # stream entry recovers this same owner after a controller restart.
        self.save(job, worker=worker)
        if reused:
            self.status(job, "reusing", "Reusing the GPU pod from the previous image…")
        else:
            self.status(job, "starting", "Starting Kubernetes GPU pod…")
        return worker

    def process(self, job_id):
        if isinstance(job_id, bytes):
            job_id = job_id.decode("ascii")
        UUID(job_id)
        raw = self.store.get(f"table-demo:job:{job_id}")
        if not raw:
            raise RuntimeError(f"Missing metadata for queued job {job_id}")
        job = json.loads(raw)
        if job.get("state") in ("complete", "failed"):
            return
        worker = self.worker()
        if "outcome" not in job:
            job.setdefault("startedAt", time.time())
            try:
                deadline = job["startedAt"] + self.timeout
                if job.get("backendReadyAt"):
                    deadline += self.extraction_timeout
                if time.time() >= deadline:
                    stage = "extraction" if job.get("backendReadyAt") else "startup"
                    raise JobError(f"{stage}_timeout", stage, "The GPU job deadline elapsed while the controller was unavailable. Please try again.")
                worker = self.acquire_worker(job)
                self.ensure_pod(job)
                address = self.wait_for_server(job)
                if job.get("kind", "extraction") == "startup_test":
                    result = self.startup_test(job, address)
                else:
                    result = self.extract(job, address)
                job["outcome"] = {"event": "complete", "data": {"result": result}}
            except redis.RedisError:
                raise
            except Exception as error:
                logging.exception("GPU job %s failed", job_id)
                failure = error if isinstance(error, JobError) else JobError(
                    "job_failed", "controller", "The GPU job could not finish. Please try again.")
                job["outcome"] = {"event": "failed", "data": failure.as_dict()}
                if job.get("podName"):
                    self.log_worker_failure(job["podName"], job_id)
                if worker and worker.get("jobId") == job_id and self.unusable_worker(failure):
                    worker["state"] = "discard"

        # An outcome saved by an older controller is delivered without rerunning
        # inference. Its per-job pod is discarded because it may have a deadline.
        if not worker and job.get("podName"):
            worker = {"podName": job["podName"], "image": self.image, "state": "discard", "jobId": job_id}
        owned_worker = worker if worker and worker.get("jobId") == job_id else None
        if owned_worker and owned_worker["state"] != "discard":
            owned_worker.update(state="idle", idleUntil=time.time() + self.gpu_idle_timeout)
            minutes = self.gpu_idle_timeout / 60
            duration = f"{minutes:g} minute{'s' if minutes != 1 else ''}"
            self.status(job, "warm", f"GPU stays ready for {duration} after this job. Upload another image to reuse it.")
        outcome = job["outcome"]
        job["state"] = outcome["event"]
        if outcome["event"] == "complete":
            job["result"] = outcome["data"]["result"]
        else:
            job["error"] = outcome["data"]
        # Persist the terminal event and idle deadline atomically; the browser
        # receives the table immediately, without waiting for GPU cleanup.
        self.save(job, outcome["event"], outcome["data"], worker=owned_worker)
        logging.info("Job %s: %s; GPU worker %s, image retained", job_id, job["state"],
                     owned_worker["state"] if owned_worker else "not allocated")

    def run_once(self):
        # Recover this single consumer's unfinished work before taking new uploads.
        batches = self.store.xreadgroup(GROUP, CONSUMER, {QUEUE: "0"}, count=1)
        if not batches or not batches[0][1]:
            batches = self.store.xreadgroup(GROUP, CONSUMER, {QUEUE: ">"}, count=1, block=5000)
        for _, messages in batches:
            for entry_id, fields in messages:
                self.process(fields.get(b"jobId", fields.get("jobId")))
                with self.store.pipeline(transaction=True) as pipe:
                    pipe.xack(QUEUE, GROUP, entry_id)
                    pipe.xdel(QUEUE, entry_id)
                    pipe.execute()
        # Queue reads always precede idle cleanup so already queued work can claim
        # the worker. Bounded blocking also expires idle pods without a new upload.
        self.maintain_worker()

    def run(self):
        try:
            self.store.xgroup_create(QUEUE, GROUP, id="0", mkstream=True)
        except redis.ResponseError as error:
            if "BUSYGROUP" not in str(error):
                raise
        while True:
            try:
                self.run_once()
            except Exception:
                logging.exception("Controller iteration failed; pending work will be retried")
                time.sleep(5)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    config.load_incluster_config()
    Controller(
        # Image values contain arbitrary bytes; only metadata and stream fields are decoded.
        redis.Redis.from_url(os.environ["REDIS_URL"], decode_responses=False,
                             socket_connect_timeout=5, socket_timeout=10),
        client.CoreV1Api(), image=os.environ["GPU_SERVER_IMAGE"],
        namespace=os.getenv("POD_NAMESPACE", "default"), gpu_type=os.getenv("GPU_TYPE", "nvidia-l4"),
        timeout=int(os.getenv("POD_STARTUP_TIMEOUT_SECONDS", "600")),
        extraction_timeout=int(os.getenv("EXTRACTION_TIMEOUT_SECONDS", "600")),
        gpu_idle_timeout=int(os.getenv("GPU_IDLE_TIMEOUT_SECONDS", "300")),
        cpu_request=os.getenv("GPU_CPU_REQUEST", "2"), memory_request=os.getenv("GPU_MEMORY_REQUEST", "8Gi"),
        memory_limit=os.getenv("GPU_MEMORY_LIMIT", "16Gi"),
    ).run()
