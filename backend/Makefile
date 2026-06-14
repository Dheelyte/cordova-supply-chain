.PHONY: help install dev test lint format typecheck check schema clean

VENV ?= .venv
PY := $(VENV)/bin/python
UVICORN := $(VENV)/bin/uvicorn
PYTEST := $(VENV)/bin/pytest
RUFF := $(VENV)/bin/ruff
MYPY := $(VENV)/bin/mypy

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  %-12s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install: ## Create venv and install core + forensic + vlm + dev deps via uv
	uv venv $(VENV) --python 3.12
	uv pip install --python $(PY) -e ".[forensic,vlm,dev]"

install-core: ## Bootstrap-only install (no OpenCV/Pillow/numpy)
	uv venv $(VENV) --python 3.12
	uv pip install --python $(PY) -e ".[dev]"

dev: ## Run the API on :8000 with hot reload
	$(UVICORN) app.main:app --reload --host 127.0.0.1 --port 8000

test: ## Run the test suite
	$(PYTEST) -q

lint: ## ruff lint
	$(RUFF) check .

format: ## ruff format
	$(RUFF) format .

typecheck: ## mypy strict
	$(MYPY) app

check: lint typecheck test ## Run everything

schema: ## Dump the generated OpenAPI to stdout
	$(PY) -c "import json; from app.main import create_app; print(json.dumps(create_app().openapi(), indent=2))"

clean:
	rm -rf $(VENV) .pytest_cache .mypy_cache .ruff_cache **/__pycache__
