"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSubscription } from "@/lib/useSubscription";
import StatusBadge from "@/components/StatusBadge";
import {
  gql, GET_ALL_TASK, ADD_JOB, RETRY_ALL_JOB, CLEAN_JOB, STOP_ALL_JOB,
  SUBSCRIBE_TASK_DASHBOARD,
  type Task, type SubscribeTaskDashboardData, type TaskListData,
} from "@/lib/graphql";

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 flex flex-col gap-0.5 min-w-[110px] ${color}`}>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      <span className="text-xs opacity-70 font-medium">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Job modal
// ---------------------------------------------------------------------------
function AddJobModal({ tasks, onClose }: { tasks: Task[]; onClose: () => void }) {
  const [taskName, setTaskName] = useState(tasks[0]?.name ?? "");
  const [args, setArgs] = useState("{}");
  const [maxRetry, setMaxRetry] = useState(3);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr("");
    try {
      await gql(ADD_JOB, { param: { task_name: taskName, max_retry: maxRetry, args } });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Add Job</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-lg px-3 py-2">{err}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Task</label>
            <select value={taskName} onChange={e => setTaskName(e.target.value)} required
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {tasks.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Arguments <span className="text-gray-400 font-normal">(JSON)</span></label>
            <textarea value={args} onChange={e => setArgs(e.target.value)} rows={4}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder='{"key": "value"}' />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Max Retry</label>
            <input type="number" value={maxRetry} min={1} max={100} onChange={e => setMaxRetry(+e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 transition-colors">
              {loading ? "Adding…" : "Add Job"}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------
export default function Page() {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");

  const { data: subData, loading, error } = useSubscription<SubscribeTaskDashboardData>({
    query: SUBSCRIBE_TASK_DASHBOARD,
    variables: { page: 1, limit: 100, search: null },
    pollQuery: GET_ALL_TASK,
    pollInterval: 3000,
  });

  // Normalise: subscription returns listen_task_dashboard.data, poll returns get_all_task
  const tasks: Task[] = useMemo(() => {
    const raw = (subData as any);
    return raw?.listen_task_dashboard?.data ?? raw?.get_all_task ?? [];
  }, [subData]);

  // Aggregate — compute from detail fields (always accurate)
  const totals = useMemo(() => tasks.reduce(
    (acc, t) => ({
      total:    acc.total    + (t.detail.queueing + t.detail.retrying + t.detail.success + t.detail.failure + t.detail.stopped),
      queueing: acc.queueing + t.detail.queueing,
      retrying: acc.retrying + t.detail.retrying,
      success:  acc.success  + t.detail.success,
      failure:  acc.failure  + t.detail.failure,
      stopped:  acc.stopped  + t.detail.stopped,
    }),
    { total: 0, queueing: 0, retrying: 0, success: 0, failure: 0, stopped: 0 }
  ), [tasks]);

  const filtered = useMemo(() =>
    search ? tasks.filter(t => t.name.toLowerCase().includes(search.toLowerCase())) : tasks,
    [tasks, search]
  );

  const graphqlHost = process.env.NEXT_PUBLIC_GRAPHQL_HOST ?? "http://localhost:8080/graphql";

  if (error && tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="font-semibold text-gray-900 dark:text-white">Cannot connect to task queue worker</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{error}</p>
          <code className="text-xs text-gray-400 dark:text-gray-500 mt-2 block">{graphqlHost}</code>
        </div>
        <button onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <StatCard label="Total" value={totals.total}
          color="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
        <StatCard label="Queueing" value={totals.queueing}
          color="border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300" />
        <StatCard label="Running" value={totals.retrying}
          color="border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300" />
        <StatCard label="Success" value={totals.success}
          color="border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300" />
        <StatCard label="Failure" value={totals.failure}
          color="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300" />
        <StatCard label="Stopped" value={totals.stopped}
          color="border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56" />
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              Live
            </span>
          )}
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Job
          </button>
        </div>
      </div>

      {/* Task table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        {loading && tasks.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-400">Connecting…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-gray-400 dark:text-gray-500">
            <p className="text-sm">{search ? `No tasks matching "${search}"` : "No tasks registered"}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Task</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">Module</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Jobs</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtered.map((task) => {
                // Compute total from detail (accurate, not stale)
                const total = task.detail.queueing + task.detail.retrying + task.detail.success + task.detail.failure + task.detail.stopped;
                return (
                  <tr key={task.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                    <td className="px-5 py-4">
                      <button onClick={() => router.push(`/task?task_name=${encodeURIComponent(task.name)}`)}
                        className="font-mono font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 text-left">
                        {task.name}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-gray-500 dark:text-gray-400 hidden sm:table-cell">{task.module_name}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="font-bold text-gray-900 dark:text-white tabular-nums">{total}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {task.detail.queueing > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium tabular-nums">
                            {task.detail.queueing} queued
                          </span>
                        )}
                        {task.detail.retrying > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium tabular-nums">
                            {task.detail.retrying} running
                          </span>
                        )}
                        {task.detail.success > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 font-medium tabular-nums">
                            {task.detail.success} success
                          </span>
                        )}
                        {task.detail.failure > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-medium tabular-nums">
                            {task.detail.failure} failed
                          </span>
                        )}
                        {task.detail.stopped > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-medium tabular-nums">
                            {task.detail.stopped} stopped
                          </span>
                        )}
                        {total === 0 && <span className="text-xs text-gray-300 dark:text-gray-600">no jobs</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end items-center gap-1">
                        <button onClick={() => router.push(`/task?task_name=${encodeURIComponent(task.name)}`)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors">
                          View Jobs
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Stop all running/queued jobs for "${task.name}"?`)) return;
                            await gql(STOP_ALL_JOB, { task_name: task.name });
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
                          title="Stop all running/queued jobs">
                          ⏹
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Retry all failure/stopped jobs for "${task.name}"?`)) return;
                            await gql(RETRY_ALL_JOB, { filter: { task_name: task.name, statuses: ["FAILURE", "STOPPED"] } });
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950 text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                          title="Retry all failed/stopped">
                          🔄
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Clear all jobs for "${task.name}"?`)) return;
                            await gql(CLEAN_JOB, { filter: { task_name: task.name, statuses: ["SUCCESS", "FAILURE", "STOPPED"] } });
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          title="Clear jobs">
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-center text-gray-400 dark:text-gray-600">
        Real-time · GraphQL subscriptions
      </p>

      {showAdd && <AddJobModal tasks={tasks} onClose={() => setShowAdd(false)} />}
    </div>
  );
}
