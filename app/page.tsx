"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { gql, GET_ALL_TASK, ADD_JOB, RETRY_ALL_JOB, CLEAN_JOB, type TaskListData, type Task } from "@/lib/graphql";

const STATUS_TAG: Record<string, { label: string; cls: string }> = {
  queueing: { label: "Queueing", cls: "bg-gray-100 text-gray-700 border-gray-300" },
  retrying: { label: "Running",  cls: "bg-blue-100 text-blue-700 border-blue-300" },
  success:  { label: "Success",  cls: "bg-green-100 text-green-700 border-green-300" },
  failure:  { label: "Failure",  cls: "bg-red-100 text-red-700 border-red-300" },
  stopped:  { label: "Stopped",  cls: "bg-yellow-100 text-yellow-700 border-yellow-300" },
};

export default function Page() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addTask, setAddTask] = useState("");
  const [addArgs, setAddArgs] = useState("{}");
  const [addMaxRetry, setAddMaxRetry] = useState(3);
  const [addLoading, setAddLoading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchTasks = useCallback(async () => {
    try {
      const data = await gql<TaskListData>(GET_ALL_TASK);
      setTasks(data.get_all_task);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    const id = setInterval(fetchTasks, 5000);
    return () => clearInterval(id);
  }, [fetchTasks]);

  const totals = tasks.reduce(
    (acc, t) => ({
      total: acc.total + t.total_jobs,
      queueing: acc.queueing + t.detail.queueing,
      retrying: acc.retrying + t.detail.retrying,
      success: acc.success + t.detail.success,
      failure: acc.failure + t.detail.failure,
      stopped: acc.stopped + t.detail.stopped,
    }),
    { total: 0, queueing: 0, retrying: 0, success: 0, failure: 0, stopped: 0 }
  );

  async function handleAddJob(e: React.FormEvent) {
    e.preventDefault();
    setAddLoading(true);
    try {
      await gql(ADD_JOB, { param: { task_name: addTask, max_retry: addMaxRetry, args: addArgs } });
      setShowAdd(false);
      setAddArgs("{}");
      await fetchTasks();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add job");
    } finally {
      setAddLoading(false);
    }
  }

  const filtered = tasks.filter(t =>
    search === "" || t.name.toLowerCase().includes(search.toLowerCase())
  );

  const graphqlHost = process.env.NEXT_PUBLIC_GRAPHQL_HOST ?? "http://localhost:8080/graphql";

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-10 text-center mt-10">
        <p className="text-red-700 font-semibold text-lg">⚠ Cannot connect to task queue worker</p>
        <p className="text-red-500 text-sm mt-2">{error}</p>
        <p className="text-gray-500 text-xs mt-4">
          Connecting to: <code className="bg-gray-100 px-1 rounded">{graphqlHost}</code>
        </p>
        <button onClick={fetchTasks} className="mt-4 text-sm px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50">
          Retry connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-3 items-center">
        {[
          { label: "Total All Jobs", value: totals.total, cls: "bg-purple-100 text-purple-700 border-purple-300" },
          { label: "All Queued", value: totals.queueing, cls: "bg-gray-100 text-gray-700 border-gray-300" },
          { label: "All Running", value: totals.retrying, cls: "bg-blue-100 text-blue-700 border-blue-300" },
          { label: "All Succeeded", value: totals.success, cls: "bg-green-100 text-green-700 border-green-300" },
          { label: "All Failed", value: totals.failure, cls: "bg-red-100 text-red-700 border-red-300" },
          { label: "All Stopped", value: totals.stopped, cls: "bg-yellow-100 text-yellow-700 border-yellow-300" },
        ].map(({ label, value, cls }) => (
          <span key={label} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${cls}`}>
            {label}: <b>{value}</b>
          </span>
        ))}
        {loading && <span className="text-xs text-gray-400 animate-pulse">refreshing…</span>}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <input
          type="text"
          placeholder="Search task..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={() => { setAddTask(tasks[0]?.name ?? ""); setShowAdd(true); }}
          className="text-sm px-4 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium"
        >
          + Add Job
        </button>
      </div>

      {/* Task table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {loading && tasks.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Loading tasks…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No tasks registered</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Task Name</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Module</th>
                <th className="text-center px-5 py-3 font-semibold text-gray-600">Total Jobs</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((task) => (
                <tr key={task.name} className="hover:bg-gray-50">
                  <td className="px-5 py-4 font-mono font-medium text-indigo-700">{task.name}</td>
                  <td className="px-5 py-4 text-gray-600">{task.module_name}</td>
                  <td className="px-5 py-4 text-center font-bold text-gray-800">{task.total_jobs}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {(["queueing","retrying","success","failure","stopped"] as const).map(s => (
                        task.detail[s] > 0 && (
                          <span key={s} className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${STATUS_TAG[s].cls}`}>
                            {STATUS_TAG[s].label}: <b className="ml-1">{task.detail[s]}</b>
                          </span>
                        )
                      ))}
                      {task.total_jobs === 0 && <span className="text-gray-300 text-xs">no jobs</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => router.push(`/task?task_name=${encodeURIComponent(task.name)}`)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium"
                      >
                        View Jobs
                      </button>
                      <div className="relative group">
                        <button className="text-xs px-2 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-600">
                          ⋯
                        </button>
                        <div className="absolute right-0 top-8 hidden group-hover:block bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[140px]">
                          <button
                            onClick={async () => {
                              if (!confirm(`Retry all failure/stopped jobs for "${task.name}"?`)) return;
                              await gql(RETRY_ALL_JOB, { filter: { task_name: task.name, statuses: ["FAILURE", "STOPPED"] } });
                              fetchTasks();
                            }}
                            className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 text-blue-600"
                          >
                            🔄 Retry All
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Clear all success/failure/stopped jobs for "${task.name}"?`)) return;
                              await gql(CLEAN_JOB, { filter: { task_name: task.name, statuses: ["SUCCESS", "FAILURE", "STOPPED"] } });
                              fetchTasks();
                            }}
                            className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 text-red-600"
                          >
                            🗑 Clear Jobs
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">Auto-refreshes every 5 seconds</p>

      {/* Add Job Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">Add Job</h2>
            <form onSubmit={handleAddJob} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Task Name</label>
                <select
                  value={addTask}
                  onChange={e => setAddTask(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  {tasks.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Arguments (JSON)</label>
                <textarea
                  value={addArgs}
                  onChange={e => setAddArgs(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder='{"key": "value"}'
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Retry</label>
                <input
                  type="number" value={addMaxRetry} min={1} max={100}
                  onChange={e => setAddMaxRetry(parseInt(e.target.value, 10))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={addLoading}
                  className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {addLoading ? "Adding…" : "Add Job"}
                </button>
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
