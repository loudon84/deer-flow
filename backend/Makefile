install:
	uv sync

dev:
	uv run langgraph dev --no-browser --allow-blocking --no-reload --n-jobs-per-worker 10

gateway:
	PYTHONPATH=. uv run uvicorn app.gateway.app:app --host 0.0.0.0 --port 8001

studio:
	PYTHONPATH=packages/studio:. uv run python -m studio.main

studio-worker:
	PYTHONPATH=packages/studio:. uv run python -m studio.workers.run_generation_worker

studio-ragflow-worker:
	PYTHONPATH=packages/studio:. uv run python -m studio.workers.run_ragflow_worker

test:
	PYTHONPATH=. uv run pytest tests/ -v

lint:
	uvx ruff check .
	uvx ruff format --check .

format:
	uvx ruff check . --fix && uvx ruff format .
