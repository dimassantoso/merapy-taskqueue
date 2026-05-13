.PHONY: dev build embed clean

KAPYNIS_DIR ?= $(shell cd .. && pwd)/kapynis
EMBED_TARGET = $(KAPYNIS_DIR)/src/kapynis/codebase/app/task_queue_worker/dashboard_static

dev:
	npm run dev

build:
	npm run build

# Build and embed the static output directly into the kapynis package.
# This mirrors candi's embed.FS approach — users get the dashboard for free
# just by installing kapynis, no separate copy step needed.
#
# Usage:
#   make embed                          # uses ../kapynis as default
#   make embed KAPYNIS_DIR=/path/to/kapynis
embed: build
	@echo "Embedding dashboard into kapynis at $(EMBED_TARGET)"
	@rm -rf "$(EMBED_TARGET)"
	@cp -r out "$(EMBED_TARGET)"
	@echo "✓ Done. Commit $(EMBED_TARGET) to kapynis repo."

clean:
	rm -rf out .next
