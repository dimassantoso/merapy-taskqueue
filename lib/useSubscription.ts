"use client";

/**
 * useSubscription — GraphQL subscription over WebSocket using graphql-ws.
 *
 * Falls back to polling (every 3s) if WebSocket is unavailable (e.g. during
 * static export preview or when the server doesn't support subscriptions).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient, Client } from "graphql-ws";
import { gql } from "./graphql";

const GQL_HOST =
  process.env.NEXT_PUBLIC_GRAPHQL_HOST ?? "http://localhost:8080/graphql";

// Convert http(s):// → ws(s)://
const WS_HOST = GQL_HOST.replace(/^http/, "ws");

let _wsClient: Client | null = null;

function getWsClient(): Client {
  if (!_wsClient) {
    _wsClient = createClient({
      url: WS_HOST,
      retryAttempts: Infinity,
      shouldRetry: () => true,
      retryWait: async (retries) => {
        await new Promise((r) => setTimeout(r, Math.min(retries * 1000, 5000)));
      },
    });
  }
  return _wsClient;
}

interface UseSubscriptionOptions<T> {
  query: string;
  variables?: Record<string, unknown>;
  /** Fallback poll interval in ms if WS fails. Default 3000. */
  pollInterval?: number;
  /** Query string to use for polling fallback (defaults to same query) */
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
}: UseSubscriptionOptions<T>): UseSubscriptionResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsFailedRef = useRef(false);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    const q = pollQuery ?? query;
    const fetch = async () => {
      try {
        const result = await gql<T>(q, variables);
        setData(result);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      } finally {
        setLoading(false);
      }
    };
    fetch();
    pollRef.current = setInterval(fetch, pollInterval);
  }, [query, pollQuery, variables, pollInterval]);

  useEffect(() => {
    setLoading(true);
    let disposed = false;

    const client = getWsClient();

    // Try WebSocket subscription first
    const unsub = client.subscribe<T>(
      { query, variables },
      {
        next: (value) => {
          if (disposed) return;
          if (value.data) {
            setData(value.data);
            setError(null);
            setLoading(false);
          }
        },
        error: (err) => {
          if (disposed) return;
          // WS failed — fall back to polling
          wsFailedRef.current = true;
          console.warn("GraphQL subscription failed, falling back to polling:", err);
          startPolling();
        },
        complete: () => {
          if (disposed) return;
          startPolling();
        },
      }
    );

    unsubRef.current = unsub;

    // If no data after 3s, assume WS isn't working and start polling
    const wsTimeout = setTimeout(() => {
      if (!disposed && loading && !wsFailedRef.current) {
        wsFailedRef.current = true;
        startPolling();
      }
    }, 3000);

    return () => {
      disposed = true;
      clearTimeout(wsTimeout);
      unsub();
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [query, JSON.stringify(variables)]); // eslint-disable-line

  return { data, loading, error };
}
