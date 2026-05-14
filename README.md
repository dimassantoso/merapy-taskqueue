# merapy-taskqueue-dashboard

Dashboard for monitoring and managing [kapynis](https://github.com/dimassantoso/merapy) task queue worker jobs.

## Requirements

- Node.js 18+
- A running kapynis service with `USE_TASK_QUEUE_WORKER=true`

## Setup

```bash
npm install
cp .env.sample .env.local
```

## Embedding into kapynis (one-time, for maintainers)

This mirrors candi's `embed.FS` approach — the dashboard is bundled inside the kapynis package so users get it automatically with `pip install kapynis`.

```bash
# From this repo, with ../kapynis pointing to the kapynis repo:
make embed

# Or specify the kapynis path explicitly:
make embed KAPYNIS_DIR=/path/to/kapynis
```

Then commit the generated `dashboard_static/` directory in the kapynis repo.

## Development

```bash
npm run dev   # hot reload at http://localhost:3000
```

Set `NEXT_PUBLIC_GRAPHQL_HOST=http://localhost:8080/graphql` in `.env.local` (already the default).

## How it works

When `USE_TASK_QUEUE_WORKER=true`, the merapy task queue worker automatically serves:
- `http://localhost:8080/` — this dashboard UI
- `http://localhost:8080/graphql` — GraphQL API

No separate process needed — just `make run` in your service.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_GRAPHQL_HOST` | `http://localhost:8080/graphql` | merapy task queue GraphQL endpoint |

The GraphQL endpoint is served by the merapy task queue worker on `TASK_QUEUE_DASHBOARD_PORT` (default `8080`).

## Features

- View all jobs with status, retries, arguments, and errors
- Filter by task name and status
- Retry failed/stopped jobs
- Delete individual jobs
- Bulk retry / clean by task + status
- Pagination

## Status values

| Status | Meaning |
|--------|---------|
| `QUEUEING` | Waiting to be picked up |
| `RETRYING` | Currently running / will retry |
| `SUCCESS` | Completed successfully |
| `FAILURE` | Failed after max retries |
| `STOPPED` | Manually stopped |
