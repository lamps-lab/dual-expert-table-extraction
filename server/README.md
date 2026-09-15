# Hello World server

For the upload → GPU pod → streamed startup test, see [DEPLOYMENT.md](DEPLOYMENT.md).

Run from this folder with your Python environment activated:

```bash
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Open http://127.0.0.1:8000/ to see `Hello World`.

## Docker

From this folder:

```bash
docker build -t hello-server .
docker run --rm -p 8000:8000 hello-server
```

Open http://127.0.0.1:8000/ to see `Hello World`.
