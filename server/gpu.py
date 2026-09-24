"""Small CUDA checks that do not load Nougat or call either LLM."""

import ctypes
import glob

GPU_UNAVAILABLE_MESSAGE = "The Nougat GPU is unavailable. Please try again later."


def gpu_diagnostics():
    details = {"cuda_available": False, "device_count": 0, "devices": []}
    try:
        import torch

        details.update(torch_version=torch.__version__, cuda_runtime=torch.version.cuda)
        details["device_files"] = glob.glob("/dev/nvidia*")
        try:
            ctypes.CDLL("libcuda.so.1")
        except OSError as error:
            details["driver_library_error"] = str(error)
        # is_available alone can use NVML. Initializing and allocating a tiny
        # tensor verifies that CUDA computation actually works in this image.
        torch.cuda.init()
        device_count = torch.cuda.device_count()
        if device_count < 1:
            raise RuntimeError("CUDA did not expose any devices.")
        torch.ones(1, device="cuda").sum().item()
        details.update(cuda_available=True, device_count=device_count,
                       devices=[torch.cuda.get_device_name(i) for i in range(device_count)])
    except Exception as error:
        details["cuda_init_error"] = str(error)
        details["error"] = {"code": "configuration_error", "stage": "nougat", "message": GPU_UNAVAILABLE_MESSAGE}
    return details
