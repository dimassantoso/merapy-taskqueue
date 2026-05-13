"use client";

import type { JobListData } from "@/lib/graphql";

const STATUSES = ["QUEUEING", "RETRYING", "SUCCESS", "FAILURE", "STOPPED"] as const;

const STAT_STYLES: Record<string, string> = {
  QUEUEING: "bg-blue-50 border-blue-200 text-blue-700",
  RETRYING: "bg-yellow-50 border-yellow-200 text-yellow-700",
  SUCCESS:  "bg-green-50 border-green-200 text-green-700",
  FAILURE:  "bg-red-50 border-red-200 text-red-700",
  STOPPED:  "bg-gray-50 border-gray-200 text-gray-600",
};

export default function StatsBar({ data }: { data: JobListData | null }) {
  const total = data?.get_all_job.meta.total_records ?? 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-center">
        <p className="text-2xl font-bold text-indigo-700">{total}</p>
        <p className="text-xs text-indigo-500 mt-1 uppercase tracking-wide">Total Jobs</p>
      </div>
      {STATUSES.map((s) => (
        <a
          key={s}
          href={`/?status=${s}`}
          className={`rounded-lg border p-4 text-center hover:opacity-80 transition-opacity ${STAT_STYLES[s]}`}
        >
          <p className="text-2xl font-bold">—</p>
          <p className="text-xs mt-1 uppercase tracking-wide">{s}</p>
        </a>
      ))}
    </div>
  );
}
