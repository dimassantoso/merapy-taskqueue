"use client";

/**
 * StatsContext — runs the listen_task_dashboard subscription once at the
 * app level so both the Navbar and the page can read stats without
 * opening a second WebSocket connection.
 */

import { createContext, useContext, useRef, useMemo, ReactNode } from "react";
import { useSubscription } from "@/lib/useSubscription";
import {
  GET_ALL_TASK,
  SUBSCRIBE_TASK_DASHBOARD,
  type Task,
  type WorkerStats,
  type SubscribeTaskDashboardData,
} from "@/lib/graphql";

interface StatsContextValue {
  tasks: Task[];
  stats: WorkerStats | null;
  clientCount: number;
  /** "user-service" → "USER SERVICE" */
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

export function StatsProvider({ children }: { children: ReactNode }) {
  const { data: subData, loading, error } = useSubscription<SubscribeTaskDashboardData>({
    query: SUBSCRIBE_TASK_DASHBOARD,
    variables: { page: 1, limit: 100, search: null },
    pollQuery: GET_ALL_TASK,
    pollInterval: 3000,
  });

  const tasks: Task[] = useMemo(() => {
    const raw = subData as any;
    return raw?.listen_task_dashboard?.data ?? raw?.get_all_task ?? [];
  }, [subData]);

  const lastStatsRef = useRef<WorkerStats | null>(null);
  const freshStats: WorkerStats | null = useMemo(() => {
    const raw = subData as any;
    return raw?.listen_task_dashboard?.stats ?? null;
  }, [subData]);
  if (freshStats) lastStatsRef.current = freshStats;
  const stats = lastStatsRef.current;

  const lastClientsRef = useRef<number>(0);
  const freshClients: number = useMemo(() => {
    const raw = subData as any;
    return raw?.listen_task_dashboard?.meta?.total_client_subscriber ?? 0;
  }, [subData]);
  if (freshClients > 0) lastClientsRef.current = freshClients;
  const clientCount = lastClientsRef.current;

  // "user-service" → "USER SERVICE", "my_app" → "MY APP"
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

export function useStats() {
  return useContext(StatsContext);
}
