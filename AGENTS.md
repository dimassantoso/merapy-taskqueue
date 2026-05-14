<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# merapy-taskqueue-dashboard — agent context

## What this is

Next.js 16 static dashboard for the merapy task queue worker. Built and embedded into the merapy Python package so users get it automatically.

## Key files

| File | Purpose |
|------|---------|
| `app/page.tsx` | Main dashboard — task list, job summary cards, info panel |
| `app/task/page.tsx` | Job list for a specific task (paginated, filterable) |
| `app/job/page.tsx` | Single job detail view |
| `app/layout.tsx` | Root layout — wraps with `StatsProvider` + `Navbar` |
| `components/Navbar.tsx` | Top nav — reads `serviceTitle` from `StatsContext` |
| `components/StatusBadge.tsx` | Coloured status pill |
| `lib/graphql.ts` | GQL queries/mutations/subscriptions + TypeScript types |
| `lib/useSubscription.ts` | WebSocket subscription hook with polling fallback |
| `lib/StatsContext.tsx` | Shared React context — single subscription for whole app |

## Architecture

```
StatsProvider (layout.tsx)
  └─ runs listen_task_dashboard subscription once
  └─ exposes: tasks, stats, clientCount, serviceTitle, loading, error

Navbar.tsx          ← reads serviceTitle from StatsContext
app/page.tsx        ← reads tasks/stats/clientCount from StatsContext
app/task/page.tsx   ← own subscription: listen_all_job
app/job/page.tsx    ← own subscription: listen_all_job (filtered by job_id)
```

## GraphQL connection

- HTTP: `NEXT_PUBLIC_GRAPHQL_HOST` (default `http://localhost:8080/graphql`)
- WS: same host with `http` → `ws` substitution
- Falls back to HTTP polling (3s) if WebSocket unavailable

## WorkerStats fields (from subscription)

```typescript
interface WorkerStats {
  memory_rss_mb: number;    // displayed as auto-scaled: B / KB / MB / GB / TB
  memory_vms_mb: number;
  memory_percent: number;   // %
  cpu_percent: number;      // %
  merapy_version: string;
  service_name: string;     // formatted as "USER SERVICE" in navbar
  service_version: string;
  build_number: string;
  git_commit: string;       // truncated to 7 chars if full SHA
  build_date: string;       // truncated to date part if ISO timestamp
}
```

## UI conventions

- Memory values auto-scale via `fmtMem(mb)`: B → KB → MB → GB → TB
- Stop buttons are **disabled** when no QUEUEING/RETRYING jobs exist for that task
- Stats bar always visible — shows `—` until first subscription push, never disappears on reconnect (uses `useRef` to hold last known values)
- Service name: `"user-service"` → `"USER SERVICE"` (replace `-_` with space, uppercase)
- Info panel has two sections: **Deployment** (versions + build info) and **Runtime** (memory + CPU + clients)

## Build + embed

```bash
npm run build                                          # build only
make embed MERAPY_DIR=/path/to/merapy                 # build + copy to dashboard_static/
```

Always run `make embed` after any UI change before committing to merapy.

## Critical rules

1. **Never use `output: "export"` with `useSearchParams`** without a `<Suspense>` boundary — wrap pages that use it.
2. **`auto_camel_case=False`** on the backend — all GraphQL fields are snake_case. Never camelCase in queries.
3. **Single subscription** — `StatsContext` runs `listen_task_dashboard` once. Don't add a second subscription for the same data in `page.tsx`.
4. **Sticky stats** — use `useRef` to hold last known stats/clientCount so the panel never flickers to `—` on reconnect.
