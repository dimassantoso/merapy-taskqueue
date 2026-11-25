import { createClient, type Client } from "graphql-ws";
import { useEffect, useRef, useState } from "preact/hooks";
import { getGraphQLWsUrl, gql } from "./graphql";

let _wsClient: Client | null = null;

function getWsClient(): Client {
  if (!_wsClient) {
    _wsClient = createClient({
      url: getGraphQLWsUrl(),
      retryAttempts: Infinity,
      shouldRetry: () => true,
      retryWait: async (retries) => {
        await new Promise((r) => setTimeout(r, Math.min((retries + 1) * 1000, 5000)));
      },
    });
  }
  return _wsClient;
}

interface UseSubscriptionOptions {
  query: string;
  variables?: Record<string, unknown>;
  pollInterval?: number;
  pollQuery?: string;
}

interface UseSubscriptionResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useSubscription<T = unknown>({
  query,
  variables,
  pollInterval = 3000,
  pollQuery,
}: UseSubscriptionOptions): UseSubscriptionResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const varsKey = JSON.stringify(variables ?? {});
  const varsRef = useRef(variables);
  varsRef.current = variables;

  useEffect(() => {
    setLoading(true);
    let disposed = false;
    let received = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (pollTimer || disposed) return;
      const q = pollQuery ?? query;
      const runFetch = async () => {
        try {
          const result = await gql<T>(q, varsRef.current);
          if (disposed) return;
          received = true;
          setData(result);
          setError(null);
        } catch (e) {
          if (disposed) return;
          setError(e instanceof Error ? e.message : "Connection failed");
        } finally {
          if (!disposed) setLoading(false);
        }
      };
      void runFetch();
      pollTimer = setInterval(() => void runFetch(), pollInterval);
    };

    const client = getWsClient();
    const unsub = client.subscribe<T>(
      { query, variables: varsRef.current },
      {
        next: (value) => {
          if (disposed) return;
          if (value.data) {
            received = true;
            setData(value.data);
            setError(null);
            setLoading(false);
          }
        },
        error: () => {
          if (!disposed) startPolling();
        },
        complete: () => {
          if (!disposed) startPolling();
        },
      }
    );

    const wsTimeout = setTimeout(() => {
      if (!disposed && !received) {
        startPolling();
      }
    }, 3000);

    return () => {
      disposed = true;
      clearTimeout(wsTimeout);
      unsub();
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
  }, [query, pollQuery, pollInterval, varsKey]);

  return { data, loading, error };
}
