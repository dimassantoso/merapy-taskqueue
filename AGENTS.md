# AGENTS.md — merapy-taskqueue workspace context

## What this is

**merapy-taskqueue** — standalone async Python task queue engine + embedded Vite/Preact real-time GraphQL dashboard.
GitHub: https://github.com/dimassantoso/merapy-taskqueue

Used both standalone in any Python app and as the task queue engine inside [`merapy`](https://github.com/dimassantoso/merapy).

## Key paths

| What | Where |
|------|-------|
| Python engine & stores | `src/merapy_taskqueue/` |
| Dashboard GraphQL + static server | `src/merapy_taskqueue/dashboard.py` |
| Embedded dashboard static files | `src/merapy_taskqueue/dashboard_static/` |
| Dashboard UI source (Vite + Preact + Tailwind v4) | `ui/` |
| Tests | `tests/` |

## Dev commands

```bash
python3.12 -m venv .venv
make dev                                 # install editable with [all,dev]
make test                                # pytest tests -v
make lint                                # ruff check src tests
make ui-install && make ui-build         # rebuild dashboard into src/merapy_taskqueue/dashboard_static/
make embed MERAPY_DIR=../merapy          # rebuild + copy static assets into merapy repo
make build                               # build wheel & sdist
```

## Critical rules

1. **Keep the `candi`-style API** — simple `TaskQueue`, `JobStore`, `MemoryJobStore`, `SQLJobStore`, `MongoJobStore`, `RedisJobStore`, `TaskQueueBase`.
2. **Strawberry `auto_camel_case=False`** — all GraphQL fields stay `snake_case`.
3. **Same-origin GraphQL** — the Vite + Preact UI auto-detects `/graphql` and WebSocket (`ws://`/`wss://`) from `window.location`.
4. **Embed after UI edits** — run `make ui-build` (and `make embed` when updating `merapy`).
