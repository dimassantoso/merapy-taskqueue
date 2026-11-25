.PHONY: dev ui-install ui-build embed test lint build clean

PYTHON ?= .venv/bin/python
MERAPY_DIR ?= $(shell cd .. && pwd)/merapy
EMBED_TARGET = $(MERAPY_DIR)/src/merapy/codebase/app/task_queue_worker/dashboard_static

dev:
	$(PYTHON) -m pip install -e ".[all,dev]"

ui-install:
	cd ui && npm install

ui-build:
	cd ui && npm run build

# Build the Vite + Preact dashboard and embed into both merapy-taskqueue and merapy.
# Usage:
#   make embed
#   make embed MERAPY_DIR=/path/to/merapy
embed: ui-build
	@echo "Embedding dashboard into merapy at $(EMBED_TARGET)"
	@rm -rf "$(EMBED_TARGET)"
	@cp -r src/merapy_taskqueue/dashboard_static "$(EMBED_TARGET)"
	@echo "Done. Embedded into $(EMBED_TARGET)"

test:
	$(PYTHON) -m pytest tests -v

lint:
	$(PYTHON) -m ruff check src tests

build: ui-build
	$(PYTHON) -m build

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	rm -rf build dist *.egg-info .pytest_cache .ruff_cache .mypy_cache
