import json
import logging
import os
import time
from urllib.error import URLError
from urllib.request import urlopen
from uuid import UUID

import redis
from kubernetes import client, config
from kubernetes.client.exceptions import ApiException

QUEUE = "table-demo:queue"
GROUP = "gpu-controller"
CONSUMER = "controller" 
API_TIMEOUT = (5, 20)


class Controller:
    def __init__(self, store, api, image, namespace="default", gpu_type="nvidia-l4",
                 timeout=600, poll_seconds=2, cleanup_timeout=90):
        
        self.store, self.api, self.image = store, api, image

        self.namespace, self.gpu_type = namespace, gpu_type

        self.timeout, self.poll_seconds = timeout, poll_seconds

        self.cleanup_timeout = cleanup_timeout

    def save(self, job, event=None, data=None):
        key = f"table-demo:job:{job['id']}"

        with self.store.pipeline(transaction=True) as pipe:

            pipe.set(key, json.dumps(job))

            if event:
                pipe.rpush(f"{key}:events", json.dumps({"event": event, "data": data}))

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
                labels={"app": "table-gpu-worker", "job-id": job["id"]}),
            spec=client.V1PodSpec(
                restart_policy="Never",
                automount_service_account_token=False,
                # Stops the container even if the controller is unavailable.
                active_deadline_seconds=self.timeout + self.cleanup_timeout,
                termination_grace_period_seconds=10,
                node_selector={"cloud.google.com/gke-accelerator": self.gpu_type},
                containers=[client.V1Container(
                    name="gpu-workload", 
                    image=self.image,
                    ports=[client.V1ContainerPort(container_port=8000)],
                    resources=client.V1ResourceRequirements(
                        requests={"cpu": "500m", "memory": "512Mi"},
                        limits={"nvidia.com/gpu": "1"}
                    ),
                    readiness_probe=client.V1Probe(
                        http_get=client.V1HTTPGetAction(path="/", port=8000),
                        period_seconds=2
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

        while time.time() < job["startedAt"] + self.timeout:

            pod = self.read_pod(job["podName"])

            if pod is None:
                raise RuntimeError("GPU pod disappeared before the startup test finished.")
            
            if pod.status.phase in ("Failed", "Succeeded"):
                raise RuntimeError(f"GPU pod exited before readiness: {pod.status.reason or pod.status.phase}")
            
            if pod.status.phase == "Running":

                self.status(job, "pod_running", "GPU pod is running.")

                if pod.status.pod_ip:

                    try:
                        with urlopen(f"http://{pod.status.pod_ip}:8000/", timeout=5) as response:

                            body = response.read(1024).decode().strip()
                            if response.status == 200 and body == "Hello World":
                                self.status(job, "backend_ready", "GPU server responded: Hello World.")
                                return {
                                    "success": True, 
                                    "kind": "startup_test", 
                                    "response": body,
                                    "imageProcessed": False, 
                                    "imageRetained": True,
                                    "message": "GPU startup test complete. Image retained; extraction has not run.",
                                }
                    except (URLError, TimeoutError, OSError):
                        pass  # Running does not necessarily mean Uvicorn is ready yet.
            time.sleep(self.poll_seconds)
        raise TimeoutError(f"GPU server was not ready within {self.timeout} seconds.")

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

    def process(self, job_id):

        UUID(job_id) 

        raw = self.store.get(f"table-demo:job:{job_id}")

        if not raw:
            raise RuntimeError(f"Missing metadata for queued job {job_id}")
        
        job = json.loads(raw)

        if job.get("state") in ("complete", "failed"):
            return
        
        if "outcome" not in job:

            job.setdefault("startedAt", time.time())
            job["podName"] = f"table-gpu-{job_id}"
            job["state"] = "running"
            self.save(job)

            try:
                self.status(job, "starting", "Starting Kubernetes GPU pod…")

                if time.time() >= job["startedAt"] + self.timeout:
                    raise TimeoutError("GPU startup deadline elapsed while the controller was unavailable.")
                
                self.ensure_pod(job)
                job["outcome"] = {"event": "complete", "data": {"result": self.wait_for_server(job)}}

            except redis.RedisError:
                raise 

            except Exception as error:
                logging.exception("GPU job %s failed", job_id)
                job["outcome"] = {"event": "failed", "data": {
                    "message": f"GPU startup failed: {error}. Image retained.",
                }}

            self.save(job)

        self.status(job, "cleanup", "Removing the GPU pod…")
        self.cleanup(job["podName"])
        outcome = job["outcome"]
        job["state"] = outcome["event"]

        if outcome["event"] == "complete":
            job["result"] = outcome["data"]["result"]

        self.save(job, outcome["event"], outcome["data"])
        logging.info("Job %s: %s; GPU pod removed, image retained", job_id, job["state"])

    def run(self):

        try:
            self.store.xgroup_create(QUEUE, GROUP, id="0", mkstream=True)
        except redis.ResponseError as error:
            if "BUSYGROUP" not in str(error):
                raise

        while True:
            try:
                # Recover this single consumer's unfinished work before taking new uploads.
                batches = self.store.xreadgroup(GROUP, CONSUMER, {QUEUE: "0"}, count=1)

                if not batches or not batches[0][1]:
                    batches = self.store.xreadgroup(GROUP, CONSUMER, {QUEUE: ">"}, count=1, block=5000)

                for _, messages in batches:
                    for entry_id, fields in messages:
                        self.process(fields["jobId"])
                        with self.store.pipeline(transaction=True) as pipe:
                            pipe.xack(QUEUE, GROUP, entry_id)
                            pipe.xdel(QUEUE, entry_id)
                            pipe.execute()
            except Exception:
                logging.exception("Controller iteration failed; pending work will be retried")
                time.sleep(5)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    config.load_incluster_config()
    Controller(
        redis.Redis.from_url(
            os.environ["REDIS_URL"], 
            decode_responses=True,
            socket_connect_timeout=5, 
            socket_timeout=10
        ),
        client.CoreV1Api(), 
        image=os.environ["GPU_SERVER_IMAGE"],
        namespace=os.getenv("POD_NAMESPACE", "default"),
        gpu_type=os.getenv("GPU_TYPE", "nvidia-l4"),
        timeout=int(os.getenv("POD_STARTUP_TIMEOUT_SECONDS", "600")),
    ).run()
