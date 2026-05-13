"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { gql, RETRY_JOB, DELETE_JOB, RETRY_ALL_JOB, CLEAN_JOB, STATUS_COLORS, type Job, type JobMeta } from "@/lib/graphql";

interface Props {
  jobs: Job[];
  meta: JobMeta;
  currentTask?: string;
  currentStatus?: string;
}

export default function JobTable({ jobs, meta, currentTask, currentStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);

  async function handleRetry(jobId: string) {
    setActionId(jobId);
    try {
      await gql(RETRY_JOB, { job_id: jobId });
      startTransition(() => router.refresh());
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(jobId: string) {
    if (!confirm("Delete this job?")) return;
    setActionId(jobId);
    try {
      await gql(DELETE_JOB, { job_id: jobId });
      startTransition(() => router.refresh());
    } finally {
      setActionId(null);
    }
  }

  async function handleRetryAll() {
    if (!currentTask) return;
    if (!confirm(`Retry all ${currentStatus ?? "failed"} jobs for "${currentTask}"?`)) return;
    await gql(RETRY_ALL_JOB, {
      filter: {
        task_name: currentTask,
        statuses: currentStatus ? [currentStatus] : ["FAILURE"],
      },
    });
    startTransition(() => router.refresh());
  }

  async function handleCleanAll() {
    if (!currentTask) return;
    if (!confirm(`Delete all ${currentStatus ?? "success"} jobs for "${currentTask}"?`)) return;
    await gql(CLEAN_JOB, {
      filter: {
        task_name: currentTask,
        statuses: currentStatus ? [currentStatus] : ["SUCCESS"],
      },
    });
    startTransition(() => router.refresh());
  }

  function goPage(p: number) {
    const url = new URL(window.location.href);
    url.searchParams.set("page", String(p));
    startTransition(() => router.push(url.pathname + url.search));
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {currentTask && (
            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-mono">
              {currentTask}
            </span>
          )}
          {currentStatus && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[currentStatus] ?? ""}`}>
              {currentStatus}
            </span>
          )}
          <span className="text-gray-400">{meta.total_records} jobs</span>
          {(currentTask || currentStatus) && (
            <a href="/" className="text-indigo-600 hover:underline ml-2">
              Clear filters
            </a>
          )}
        </div>
        {currentTask && (
          <div className="flex gap-2">
            <button
              onClick={handleRetryAll}
              className="text-xs px-3 py-1.5 rounded border border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
            >
              Retry all
            </button>
            <button
              onClick={handleCleanAll}
              className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
            >
              Clean
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {jobs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No jobs found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Task</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Retries</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Arguments</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Error</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map((job) => (
                <tr key={job.id} className={`hover:bg-gray-50 ${isPending && actionId === job.id ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <a
                      href={`/?task=${job.task_name}`}
                      className="font-mono text-indigo-600 hover:underline text-xs"
                    >
                      {job.task_name}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <a href={`/?status=${job.status}`}>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[job.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {job.status}
                      </span>
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {job.retries}/{job.max_retry}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <span className="font-mono text-xs text-gray-600 truncate block max-w-[200px]" title={job.arguments}>
                      {job.arguments || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {job.error ? (
                      <span className="text-xs text-red-600 truncate block max-w-[200px]" title={job.error}>
                        {job.error}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {job.created_at ? new Date(job.created_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {(job.status === "FAILURE" || job.status === "STOPPED") && (
                        <button
                          onClick={() => handleRetry(job.id)}
                          disabled={actionId === job.id}
                          className="text-xs px-2 py-1 rounded border border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 disabled:opacity-50"
                        >
                          Retry
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(job.id)}
                        disabled={actionId === job.id}
                        className="text-xs px-2 py-1 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                      >
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
          <span>
            Page {meta.page} of {meta.total_pages} ({meta.total_records} total)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => goPage(meta.page - 1)}
              disabled={meta.page <= 1}
              className="px-3 py-1.5 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              ← Prev
            </button>
            <button
              onClick={() => goPage(meta.page + 1)}
              disabled={meta.page >= meta.total_pages}
              className="px-3 py-1.5 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Auto-refresh note */}
      <p className="text-xs text-gray-400 text-center">
        Auto-refresh: <a href="." className="underline hover:text-gray-600">reload page</a> to see latest jobs
      </p>
    </div>
  );
}
