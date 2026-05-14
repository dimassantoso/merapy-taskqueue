.PHONY: dev build embed clean

MERAPY_DIR ?= $(shell cd .. && pwd)/merapy
EMBED_TARGET = $(MERAPY_DIR)/src/merapy/codebase/app/task_queue_worker/dashboard_static

dev:
	npm run dev

build:
	npm run build

# Build and embed the static output directly into the merapy package.
# This mirrors candi's embed.FS approach — users get the dashboard for free
# just by installing merapy, no separate copy step needed.
#
# Usage:
#   make embed                          # uses ../merapy as default
#   make embed MERAPY_DIR=/path/to/merapy
embed: build
	@echo "Embedding dashboard into merapy at $(EMBED_TARGET)"
	@rm -rf "$(EMBED_TARGET)"
	@cp -r out "$(EMBED_TARGET)"
	@echo "✓ Done. Commit $(EMBED_TARGET) to merapy repo."

clean:
	rm -rf out .next
