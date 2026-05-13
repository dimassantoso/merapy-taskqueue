"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  gql, GET_ALL_JOB, GET_COUNT_JOB, ADD_JOB, RETRY_JOB, STOP_JOB, DELETE_JOB,
  RETRY_ALL_JOB, CLEAN_JOB, STOP_ALL_JOB, SUBSCRIBE_ALL_JOB,
  STATUS_COLORS, canRetry, canStop,
  type JobListData, type Job, type JobMeta, type SubscribeAllJobData,
} from "@/lib/graphql";
import { useSubscription } from "@/lib/useSubscription";

const ALL_STATUSES = ["QUEUEING", "RETRYING", "SUCCESS", "FAILURE", "STOPPED"];

// ---------------------------------------------------------------------------
// Mutate modal — filter by status + search before retry-all or clean
// ---------------------------------------------------------------------------
interface MutateModalProps {
  action: "RETRY" | "CLEAN";
  taskName: string;
  onClose: () => void;
  onDone: () => void;
}

function MutateModal({ action, taskName, onClose, onDone }: MutateModalProps) {
  const defaultStatuses = action === "RETRY" ? ["FAILURE", "STOPPED"] : ["SUCCESS", "FAILURE", "STOPPED"];
  const [statuses, setStatuses] = useState<string[]>(defaultStatuses);
  const [search, setSearch] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchCount = useCallback(async () => {
    setCountLoading(true);
    try {
      const data = await gql<{ get_count_job: number }>(GET_COUNT_JOB, {
        filter: { task_name: taskName, statuses, search: search || undefined },
      });
      setCount(data.get_count_job);
    } catch { setCount(null); }
    finally { setCountLoading(false); }
  }, [taskName, statuses, search]);

  useEffect(() => { fetchCount(); }, [fetchCount]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const filter = { task_name: taskName, statuses, search: search || undefined };
      if (action === "RETRY") await gql(RETRY_ALL_JOB, { filter });
      else await gql(CLEAN_JOB, { filter });
      onDone();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally { setSubmitting(false); }
  }

  function toggleStatus(s: string) {
    setStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  const actionLabel = action === "RETRY" ? "Retry All" : "Clean Jobs";
  const actionCls = action === "RETRY"
    ? "bg-blue-600 hover:bg-blue-700 text-white"
    : "bg-red-600 hover:bg-red-700 text-white";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4">
        <h2 className="text-lg font-semibold mb-1">{actionLabel}</h2>
        <p className="text-sm text-gray-500 mb-4 font-mono">{taskName}</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status filter</label>
            <div className="flex flex-wrap gap-2">
              {ALL_STATUSES.map(s => (
                <button key={s} type="button"
                  onClick={() => toggleStatus(s)}
                  className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                    statuses.includes(s)
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by arguments..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="text-right text-sm text-gray-600">
            {countLoading
              ? <span className="animate-pulse">Counting…</span>
              : count !== null
                ? <span>Found <b>{count}</b> job{count !== 1 ? "s" : ""}</span>
                : null}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSubmit}
            disabled={submitting || count === 0 || statuses.length === 0}
            className={`flex-1 rounded-lg py-2 text-sm font-medium disabled:opacity-40 ${actionCls}`}
          >
            {submitting ? "Processing…" : `${actionLabel} (${count ?? "?"})`}
          </button>
          <button onClick={onClose}
            className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Job modal
// ---------------------------------------------------------------------------
interface AddJobModalProps {
  taskName: string;
  onClose: () => void;
  onDone: () => void;
}

function AddJobModal({ taskName, onClose, onDone }: AddJobModalProps) {
  const [args, setArgs] = useState("{}");
  const [maxRetry, setMaxRetry] = useState(3);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await gql(ADD_JOB, { param: { task_name: taskName, max_retry: maxRetry, args } });
      onDone();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add job");
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-semibold mb-1">Add Job</h2>
        <p className="text-sm text-gray-500 mb-4 font-mono">{taskName}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Arguments (JSON)</label>
            <textarea value={args} onChange={e => setArgs(e.target.value)} rows={5}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder='{"key": "value"}' />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Retry</label>
            <input type="number" value={maxRetry} min={1} max={100}
              onChange={e => setMaxRetry(parseInt(e.target.value, 10))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {loading ? "Adding…" : "Add Job"}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main task page
// ---------------------------------------------------------------------------
function TaskPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const taskName = searchParams.get("task_name") ?? "";
  const statusFilter = searchParams.get("statuses") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const searchParam = searchParams.get("search") ?? "";

  const [actionId, setActionId] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParam);
  const [modal, setModal] = useState<"add" | "retry" | "clean" | null>(null);

  // Build subscription filter
  const subFilter = {
    page,
    limit: 10,
    task_name: taskName || undefined,
    statuses: statusFilter ? statusFilter.split(",") : undefined,
    search: search || undefined,
  };

  // Real-time subscription with polling fallback
  const { data: subData, loading: subLoading, error: subError } = useSubscription<SubscribeAllJobData>({
    query: SUBSCRIBE_ALL_JOB,
    variables: { filter: subFilter },
    pollQuery: GET_ALL_JOB,
    pollInterval: 3000,
  });

  const loading = subLoading;
  const error = subError;
  const jobData = (subData as any)?.listen_all_job ?? (subData as any)?.get_all_job ?? null;

  // fetchJobs is only needed for mutations that need immediate refresh
  const fetchJobs = useCallback(async () => {
    // subscription handles refresh automatically; this is a no-op hint
  }, []);

  function setParam(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    if (key !== "page") params.delete("page");
    router.push("/task?" + params.toString());
  }

  async function handleRetry(jobId: string) {
    setActionId(jobId);
    try { await gql(RETRY_JOB, { job_id: jobId }); await fetchJobs(); }
    finally { setActionId(null); }
  }

  async function handleStop(jobId: string) {
    setActionId(jobId);
    try { await gql(STOP_JOB, { job_id: jobId }); await fetchJobs(); }
    finally { setActionId(null); }
  }

  async function handleDelete(jobId: string) {
    if (!confirm("Permanently delete this job?")) return;
    setActionId(jobId);
    try { await gql(DELETE_JOB, { job_id: jobId }); await fetchJobs(); }
    finally { setActionId(null); }
  }

  async function handleStopAll() {
    if (!confirm(`Stop all running/queued jobs for "${taskName}"?`)) return;
    await gql(STOP_ALL_JOB, { task_name: taskName });
    fetchJobs();
  }

  const jobs: Job[] = jobData?.data ?? [];
  const meta: JobMeta = jobData?.meta ?? { page: 1, limit: 10, total_pages: 1, total_records: 0 };

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => router.push("/")} className="text-gray-500 hover:text-indigo-600">← Dashboard</button>
        <span className="text-gray-300">/</span>
        <span className="font-semibold font-mono text-gray-800">{taskName || "All Tasks"}</span>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setParam("statuses", undefined)}
          className={`text-xs px-3 py-1.5 rounded-full border font-medium ${!statusFilter ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
          All ({meta.total_records})
        </button>
        {["QUEUEING","RETRYING","SUCCESS","FAILURE","STOPPED"].map(s => (
          <button key={s} onClick={() => setParam("statuses", s)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium ${statusFilter === s ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <input type="text" placeholder="Search jobs…" value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && fetchJobs()}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          {loading && <span className="text-xs text-gray-400 animate-pulse">refreshing…</span>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Add Job — always available */}
          <button onClick={() => setModal("add")}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium">
            + Add Job
          </button>
          {/* Retry All — re-queues FAILURE/STOPPED (with filter modal) */}
          <button onClick={() => setModal("retry")}
            className="text-xs px-3 py-1.5 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium">
            🔄 Retry All
          </button>
          {/* Stop All — stops QUEUEING/RETRYING */}
          <button onClick={handleStopAll}
            className="text-xs px-3 py-1.5 rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 font-medium">
            ⏹ Stop All
          </button>
          {/* Clear Jobs — deletes SUCCESS/FAILURE/STOPPED (with filter modal) */}
          <button onClick={() => setModal("clean")}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 text-red-600 hover:bg-red-100 font-medium">
            🗑 Clear Jobs
          </button>
        </div>
      </div>

      {/* Job table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : jobs.length === 0 && !loading ? (
          <div className="p-12 text-center text-gray-400">
            No jobs found
            <div className="mt-3">
              <button onClick={() => setModal("add")}
                className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                + Add first job
              </button>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">ID</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Retries</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Arguments</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Error</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Created At</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map((job) => (
                <tr key={job.id} className={`hover:bg-gray-50 ${actionId === job.id ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <button onClick={() => router.push(`/job?id=${job.id}`)}
                      className="font-mono text-xs text-indigo-600 hover:underline" title={job.id}>
                      {job.id.slice(0, 8)}…
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setParam("statuses", job.status)}>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[job.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {job.status}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500 text-xs">{job.retries}/{job.max_retry}</td>
                  <td className="px-4 py-3 max-w-xs">
                    <span className="font-mono text-xs text-gray-600 truncate block max-w-[180px]" title={job.arguments}>
                      {job.arguments || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {job.error
                      ? <span className="text-xs text-red-600 truncate block max-w-[180px]" title={job.error}>{job.error}</span>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {job.created_at ? new Date(job.created_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => router.push(`/job?id=${job.id}`)}
                        className="text-xs px-2 py-1 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
                        Detail
                      </button>
                      {/* Retry — only for FAILURE or STOPPED */}
                      {canRetry(job.status) && (
                        <button onClick={() => handleRetry(job.id)} disabled={actionId === job.id}
                          className="text-xs px-2 py-1 rounded border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50">
                          Retry
                        </button>
                      )}
                      {/* Stop — only for QUEUEING or RETRYING */}
                      {canStop(job.status) && (
                        <button onClick={() => handleStop(job.id)} disabled={actionId === job.id}
                          className="text-xs px-2 py-1 rounded border border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 disabled:opacity-50">
                          Stop
                        </button>
                      )}
                      {/* Delete — always available */}
                      <button onClick={() => handleDelete(job.id)} disabled={actionId === job.id}
                        className="text-xs px-2 py-1 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {meta.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {meta.page} of {meta.total_pages} ({meta.total_records} total)</span>
          <div className="flex gap-2">
            <button onClick={() => setParam("page", String(meta.page - 1))} disabled={meta.page <= 1}
              className="px-3 py-1.5 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40">← Prev</button>
            <button onClick={() => setParam("page", String(meta.page + 1))} disabled={meta.page >= meta.total_pages}
              className="px-3 py-1.5 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40">Next →</button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">Real-time via GraphQL subscriptions</p>

      {/* Modals */}
      {modal === "add" && (
        <AddJobModal taskName={taskName} onClose={() => setModal(null)} onDone={fetchJobs} />
      )}
      {modal === "retry" && (
        <MutateModal action="RETRY" taskName={taskName} onClose={() => setModal(null)} onDone={fetchJobs} />
      )}
      {modal === "clean" && (
        <MutateModal action="CLEAN" taskName={taskName} onClose={() => setModal(null)} onDone={fetchJobs} />
      )}
    </div>
  );
}

export default function TaskPageWrapper() {
  return <Suspense><TaskPage /></Suspense>;
}
