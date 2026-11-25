import { createContext, type ComponentChildren } from "preact";
import { useContext, useMemo, useRef } from "preact/hooks";
import {
  GET_ALL_TASK,
  SUBSCRIBE_TASK_DASHBOARD,
  type SubscribeTaskDashboardData,
  type Task,
  type WorkerStats,
} from "./graphql";
import { useSubscription } from "./useSubscription";

interface StatsContextValue {
  tasks: Task[];
  stats: WorkerStats | null;
  clientCount: number;
  serviceTitle: string;
  loading: boolean;
  error: string | null;
}

const StatsContext = createContext<StatsContextValue>({
  tasks: [],
  stats: null,
  clientCount: 0,
  serviceTitle: "",
  loading: true,
  error: null,
});

const SUB_VARS = { page: 1, limit: 100, search: null };

export function StatsProvider({ children }: { children: ComponentChildren }) {
  const { data: subData, loading, error } = useSubscription<SubscribeTaskDashboardData>({
    query: SUBSCRIBE_TASK_DASHBOARD,
    variables: SUB_VARS,
    pollQuery: GET_ALL_TASK,
    pollInterval: 3000,
  });

  const tasks: Task[] = useMemo(
    () => subData?.listen_task_dashboard?.data ?? subData?.get_all_task ?? [],
    [subData]
  );

  const lastStatsRef = useRef<WorkerStats | null>(null);
  const freshStats = subData?.listen_task_dashboard?.stats ?? null;
  if (freshStats) lastStatsRef.current = freshStats;
  const stats = lastStatsRef.current;

  const lastClientsRef = useRef<number>(0);
  const freshClients = subData?.listen_task_dashboard?.meta?.total_client_subscriber ?? 0;
  if (freshClients > 0) lastClientsRef.current = freshClients;
  const clientCount = lastClientsRef.current;

  const serviceTitle = useMemo(() => {
    const name = stats?.service_name ?? "";
    return name.replace(/[-_]+/g, " ").toUpperCase().trim();
  }, [stats?.service_name]);

  return (
    <StatsContext.Provider value={{ tasks, stats, clientCount, serviceTitle, loading, error }}>
      {children}
    </StatsContext.Provider>
  );
}

export function useStats(): StatsContextValue {
  return useContext(StatsContext);
}
