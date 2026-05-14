# merapy-taskqueue-dashboard

Real-time dashboard for monitoring and managing [merapy](https://github.com/dimassantoso/merapy) task queue worker jobs. Embedded into the merapy package — no separate install needed.

## Requirements

- Node.js 18+
- A running merapy service with `USE_TASK_QUEUE_WORKER=true`

## Setup

```bash
npm install
cp .env.sample .env.local
# Edit .env.local if your service runs on a different host/port
```

## Development

```bash
npm run dev   # hot reload at http://localhost:3000
```

`NEXT_PUBLIC_GRAPHQL_HOST` defaults to `http://localhost:8080/graphql` — already set in `.env.sample`.

## Embedding into merapy

The dashboard is bundled inside the merapy package so users get it automatically with `pip install merapy`. After any UI change, rebuild and embed:

```bash
make embed MERAPY_DIR=/path/to/merapy
```

Then commit the updated `dashboard_static/` directory in the merapy repo.

## How it works

When `USE_TASK_QUEUE_WORKER=true`, the merapy task queue worker automatically serves:

- `http://localhost:8080/` — this dashboard UI
- `http://localhost:8080/graphql` — GraphQL API + WebSocket subscriptions

No separate process needed — just `make run` in your service.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_GRAPHQL_HOST` | `http://localhost:8080/graphql` | merapy task queue GraphQL endpoint |

## Features

### Job management
- View all registered tasks with live job counts per status
- Drill into a task to see individual jobs (paginated, filterable by status + search)
- View full job detail: arguments, result, error, trace ID, timestamps
- Retry failed/stopped jobs (single or bulk)
- Stop running/queued jobs (single or bulk) — button disabled when nothing is stoppable
- Delete individual jobs permanently
- Bulk clean by task + status filter
- Add new jobs manually

### Real-time
- Live updates via GraphQL WebSocket subscriptions (push every 2s)
- Automatic fallback to HTTP polling if WebSocket unavailable
- Single shared subscription for the whole app (no duplicate connections)

### Service info panel
Two-section panel always visible at the top of the dashboard:

**Deployment** — version and build metadata (set via env vars in your CI/CD pipeline):
| Env var | Displayed as | Example |
|---------|-------------|---------|
| `SERVICE_NAME` | Service name in navbar | `USER SERVICE` |
| `APP_VERSION` | Service Version | `1.4.2` |
| `BUILD_NUMBER` | Build | `142` |
| `GIT_COMMIT` | Commit | `a3f9c12` (7-char short SHA) |
| `BUILD_DATE` | Built | `2026-05-14` |

**Runtime** — live process metrics (requires `psutil` in service venv):
| Metric | Unit | Description |
|--------|------|-------------|
| RSS Memory | auto-scaled (B/KB/MB/GB/TB) | Physical RAM used by the process |
| Virtual Memory | auto-scaled | Total virtual address space reserved |
| Memory Usage | % | RSS as % of total system RAM |
| CPU Usage | % | CPU time since last measurement |
| Connected Clients | count | Browser tabs subscribed to live feed |

Install psutil for full metrics: `.venv/bin/pip install psutil`

### CI/CD integration (GitHub Actions example)
```yaml
env:
  APP_VERSION: "1.4.2"
  BUILD_NUMBER: ${{ github.run_number }}
  GIT_COMMIT: ${{ github.sha }}
  BUILD_DATE: ${{ github.event.head_commit.timestamp }}
```

## Status values

| Status | Meaning |
|--------|---------|
| `QUEUEING` | Waiting to be picked up |
| `RETRYING` | Currently running / will retry on failure |
| `SUCCESS` | Completed successfully |
| `FAILURE` | Failed after max retries |
| `STOPPED` | Manually stopped |

## Button semantics

| Button | Enabled when |
|--------|-------------|
| Retry | Job status is `FAILURE` or `STOPPED` |
| Stop | Job status is `QUEUEING` or `RETRYING` |
| Stop All | Task has at least one `QUEUEING` or `RETRYING` job |
| Delete | Always |
