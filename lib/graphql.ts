/**
 * Thin GraphQL client — plain fetch, no Apollo dependency.
 * Connects to the kapynis task queue worker GraphQL API.
 */

const GQL_HOST =
  process.env.NEXT_PUBLIC_GRAPHQL_HOST ?? "http://localhost:8080/graphql";

export async function gql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(GQL_HOST, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GraphQL request failed: ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const GET_ALL_TASK = /* GraphQL */ `
  query GetAllTask {
    get_all_task {
      name module_name total_jobs
      detail { queueing retrying success failure stopped }
    }
  }
`;

export const GET_ALL_JOB = /* GraphQL */ `
  query GetAllJob($filter: GetAllJobInputResolver) {
    get_all_job(filter: $filter) {
      meta { page limit total_pages total_records }
      data {
        id task_name arguments retries max_retry interval
        status error result trace_id created_at finished_at
      }
    }
  }
`;

export const GET_COUNT_JOB = /* GraphQL */ `
  query GetCountJob($filter: GetAllJobInputResolver) {
    get_count_job(filter: $filter)
  }
`;

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Enqueue a new job */
export const ADD_JOB = /* GraphQL */ `
  mutation AddJob($param: AddJobInputResolver!) {
    add_job(param: $param)
  }
`;

/** Re-queue a FAILURE or STOPPED job (resets retries to 0) */
export const RETRY_JOB = /* GraphQL */ `
  mutation RetryJob($job_id: String!) {
    retry_job(job_id: $job_id)
  }
`;

/** Stop a single QUEUEING or RETRYING job (sets to STOPPED) */
export const STOP_JOB = /* GraphQL */ `
  mutation StopJob($job_id: String!) {
    stop_job(job_id: $job_id)
  }
`;

/** Stop ALL QUEUEING/RETRYING jobs for a task */
export const STOP_ALL_JOB = /* GraphQL */ `
  mutation StopAllJob($task_name: String!) {
    stop_all_job(task_name: $task_name)
  }
`;

/** Re-queue all FAILURE/STOPPED jobs matching filter */
export const RETRY_ALL_JOB = /* GraphQL */ `
  mutation RetryAllJob($filter: FilterMutateJobInputResolver!) {
    retry_all_job(filter: $filter)
  }
`;

/** Delete jobs matching filter */
export const CLEAN_JOB = /* GraphQL */ `
  mutation CleanJob($filter: FilterMutateJobInputResolver!) {
    clean_job(filter: $filter)
  }
`;

/** Delete a single job permanently */
export const DELETE_JOB = /* GraphQL */ `
  mutation DeleteJob($job_id: String!) {
    delete_job(job_id: $job_id)
  }
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JobMeta {
  page: number;
  limit: number;
  total_pages: number;
  total_records: number;
}

export interface Job {
  id: string;
  task_name: string;
  arguments: string;
  retries: number;
  max_retry: number;
  interval: string;
  status: string;
  error: string;
  result: string;
  trace_id: string;
  created_at: string;
  finished_at: string;
}

export interface JobListData {
  get_all_job: { meta: JobMeta; data: Job[] };
}

export interface TaskDetail {
  queueing: number;
  retrying: number;
  success: number;
  failure: number;
  stopped: number;
}

export interface Task {
  name: string;
  module_name: string;
  total_jobs: number;
  detail: TaskDetail;
}

export interface TaskListData {
  get_all_task: Task[];
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

export const STATUS_COLORS: Record<string, string> = {
  QUEUEING: "bg-gray-100 text-gray-700",
  RETRYING: "bg-blue-100 text-blue-700",
  SUCCESS:  "bg-green-100 text-green-700",
  FAILURE:  "bg-red-100 text-red-700",
  STOPPED:  "bg-yellow-100 text-yellow-700",
};

/** Jobs that can be retried */
export const canRetry = (status: string) =>
  status === "FAILURE" || status === "STOPPED";

/** Jobs that can be stopped */
export const canStop = (status: string) =>
  status === "QUEUEING" || status === "RETRYING";
