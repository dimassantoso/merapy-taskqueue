/**
 * Lightweight GraphQL fetch client.
 * Auto-detects same-origin /graphql in production so the dashboard works on
 * any port or reverse proxy; override via VITE_GRAPHQL_HOST during dev.
 */

export function getGraphQLUrl(): string {
  const envUrl = import.meta.env.VITE_GRAPHQL_HOST as string | undefined;
  if (envUrl && envUrl.trim()) return envUrl.trim();
  if (typeof window !== "undefined") {
    return `${window.location.origin}/graphql`;
  }
  return "http://localhost:8080/graphql";
}

export function getGraphQLWsUrl(): string {
  return getGraphQLUrl().replace(/^http/, "ws");
}

export async function gql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(getGraphQLUrl(), {
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
// Subscriptions
// ---------------------------------------------------------------------------

export const SUBSCRIBE_TASK_DASHBOARD = /* GraphQL */ `
  subscription ListenTaskDashboard($page: Int!, $limit: Int!, $search: String) {
    listen_task_dashboard(page: $page, limit: $limit, search: $search) {
      meta { page limit total_pages total_records total_client_subscriber }
      data {
        name module_name total_jobs is_loading
        detail { queueing retrying success failure stopped }
      }
      stats {
        memory_rss_mb memory_vms_mb memory_percent cpu_percent
        merapy_version service_name service_version build_number git_commit build_date
      }
    }
  }
`;

export const SUBSCRIBE_ALL_JOB = /* GraphQL */ `
  subscription ListenAllJob($filter: GetAllJobInputResolver) {
    listen_all_job(filter: $filter) {
      meta { page limit total_pages total_records }
      data {
        id task_name arguments retries max_retry interval
        status error result trace_id created_at finished_at
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const ADD_JOB = /* GraphQL */ `
  mutation AddJob($param: AddJobInputResolver!) {
    add_job(param: $param)
  }
`;

export const RETRY_JOB = /* GraphQL */ `
  mutation RetryJob($job_id: String!) {
    retry_job(job_id: $job_id)
  }
`;

export const STOP_JOB = /* GraphQL */ `
  mutation StopJob($job_id: String!) {
    stop_job(job_id: $job_id)
  }
`;

export const STOP_ALL_JOB = /* GraphQL */ `
  mutation StopAllJob($task_name: String!) {
    stop_all_job(task_name: $task_name)
  }
`;

export const RETRY_ALL_JOB = /* GraphQL */ `
  mutation RetryAllJob($filter: FilterMutateJobInputResolver!) {
    retry_all_job(filter: $filter)
  }
`;

export const RETRY_ALL_JOB_FORCE = /* GraphQL */ `
  mutation RetryAllJobForce($task_name: String!) {
    retry_all_job(filter: { task_name: $task_name, statuses: [] })
  }
`;

export const CLEAN_JOB = /* GraphQL */ `
  mutation CleanJob($filter: FilterMutateJobInputResolver!) {
    clean_job(filter: $filter)
  }
`;

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

export interface WorkerStats {
  memory_rss_mb: number;
  memory_vms_mb: number;
  memory_percent: number;
  cpu_percent: number;
  merapy_version: string;
  service_name: string;
  service_version: string;
  build_number: string;
  git_commit: string;
  build_date: string;
}

export interface SubscribeTaskDashboardData {
  listen_task_dashboard?: {
    meta: {
      page: number;
      limit: number;
      total_pages: number;
      total_records: number;
      total_client_subscriber: number;
    };
    data: Task[];
    stats: WorkerStats;
  };
  get_all_task?: Task[];
}

export interface SubscribeAllJobData {
  listen_all_job?: { meta: JobMeta; data: Job[] };
  get_all_job?: { meta: JobMeta; data: Job[] };
}

export const canRetry = (status: string): boolean =>
  status === "FAILURE" || status === "STOPPED";

export const canStop = (status: string): boolean =>
  status === "QUEUEING" || status === "RETRYING";
