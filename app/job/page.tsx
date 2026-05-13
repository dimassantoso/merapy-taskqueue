"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  gql, GET_ALL_JOB, RETRY_JOB, STOP_JOB, DELETE_JOB,
  STATUS_COLORS, canRetry, canStop, type Job,
} from "@/lib/graphql";

interface JobDetailData {
  get_all_job: { data: Job[] };
}

function JobPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get("id") ?? "";

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchJob = useCallback(async () => {
    if (!jobId) return;
    try {
      const data = await gql<JobDetailData>(GET_ALL_JOB, {
        filter: { job_id: jobId, limit: 1 },
      });
      setJob(data.get_all_job.data[0] ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load job");
    } finally { setLoading(false); }
  }, [jobId]);

  useEffect(() => {
    fetchJob();
    const id = setInterval(fetchJob, 5000);
    return () => clearInterval(id);
  }, [fetchJob]);

  async function handleRetry() {
    if (!job) return;
    setActionLoading(true);
    try { await gql(RETRY_JOB, { job_id: job.id }); await fetchJob(); }
    finally { setActionLoading(false); }
  }

  async function handleStop() {
    if (!job) return;
    setActionLoading(true);
    try { await gql(STOP_JOB, { job_id: job.id }); await fetchJob(); }
    finally { setActionLoading(false); }
  }

  async function handleDelete() {
    if (!job || !confirm("Permanently delete this job?")) return;
    setActionLoading(true);
    try {
      await gql(DELETE_JOB, { job_id: job.id });
      router.push(`/task?task_name=${encodeURIComponent(job.task_name)}`);
    } finally { setActionLoading(false); }
  }

  if (loading) return <div className="p-12 text-center text-gray-400">Loading…</div>;
  if (error) return <div className="p-12 text-center text-red-500">{error}</div>;
  if (!job) return <div className="p-12 text-center text-gray-400">Job not found</div>;

  function prettyJson(s: string) {
    try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
  }

  const rows: [string, React.ReactNode][] = [
    ["ID", <span className="font-mono text-sm break-all">{job.id}</span>],
    ["Task Name", (
      <button onClick={() => router.push(`/task?task_name=${encodeURIComponent(job.task_name)}`)}
        className="text-indigo-600 hover:underline font-mono font-medium">{job.task_name}</button>
    )],
    ["Status", (
      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[job.status] ?? "bg-gray-100 text-gray-600"}`}>
        {job.status}
      </span>
    )],
    ["Retries", `${job.retries} / ${job.max_retry}`],
    ["Interval", job.interval || "—"],
    ["Created At", job.created_at ? new Date(job.created_at).toLocaleString() : "—"],
    ["Finished At", job.finished_at ? new Date(job.finished_at).toLocaleString() : "—"],
    ["Trace ID", job.trace_id || "—"],
    ["Arguments", (
      <pre className="bg-gray-50 rounded-lg p-3 text-xs font-mono overflow-auto max-h-48 whitespace-pre-wrap border border-gray-200">
        {prettyJson(job.arguments)}
      </pre>
    )],
    ...(job.result ? [["Result", (
      <pre className="bg-gray-50 rounded-lg p-3 text-xs font-mono overflow-auto max-h-48 whitespace-pre-wrap border border-gray-200">
        {prettyJson(job.result)}
      </pre>
    )] as [string, React.ReactNode]] : []),
    ...(job.error ? [["Last Error", (
      <pre className="bg-red-50 text-red-700 rounded-lg p-3 text-xs font-mono overflow-auto max-h-48 whitespace-pre-wrap border border-red-200">
        {job.error}
      </pre>
    )] as [string, React.ReactNode]] : []),
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => router.push(`/task?task_name=${encodeURIComponent(job.task_name)}`)}
            className="text-gray-500 hover:text-indigo-600">
            ← {job.task_name}
          </button>
          <span className="text-gray-300">/</span>
          <span className="font-semibold text-gray-800">Job Detail</span>
        </div>

        <div className="flex gap-2">
          {/* Retry — only for FAILURE or STOPPED */}
          {canRetry(job.status) && (
            <button onClick={handleRetry} disabled={actionLoading}
              className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 font-medium">
              🔄 Retry
            </button>
          )}
          {/* Stop — only for QUEUEING or RETRYING */}
          {canStop(job.status) && (
            <button onClick={handleStop} disabled={actionLoading}
              className="text-sm px-4 py-1.5 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50 font-medium">
              ⏹ Stop
            </button>
          )}
          {/* Delete — always available */}
          <button onClick={handleDelete} disabled={actionLoading}
            className="text-sm px-4 py-1.5 rounded-lg border border-red-300 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">
            🗑 Delete
          </button>
        </div>
      </div>

      {/* Detail card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            {rows.map(([label, value]) => (
              <tr key={label as string}>
                <td className="px-5 py-3 font-semibold text-gray-500 w-32 align-top whitespace-nowrap">{label}</td>
                <td className="px-5 py-3 text-gray-800">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 text-center">Auto-refreshes every 5 seconds</p>
    </div>
  );
}

export default function JobPageWrapper() {
  return <Suspense><JobPage /></Suspense>;
}
