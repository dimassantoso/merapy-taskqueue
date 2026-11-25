import { createContext, type ComponentChildren } from "preact";
import { useCallback, useContext, useEffect, useState } from "preact/hooks";

interface RouteState {
  pathname: string;
  search: string;
}

interface RouterContextValue extends RouteState {
  searchParams: URLSearchParams;
  push: (to: string) => void;
  back: () => void;
}

function readLocation(): RouteState {
  if (typeof window === "undefined") {
    return { pathname: "/", search: "" };
  }
  return {
    pathname: window.location.pathname,
    search: window.location.search,
  };
}

const RouterContext = createContext<RouterContextValue>({
  pathname: "/",
  search: "",
  searchParams: new URLSearchParams(),
  push: () => {},
  back: () => {},
});

export function RouterProvider({ children }: { children: ComponentChildren }) {
  const [loc, setLoc] = useState<RouteState>(readLocation);

  useEffect(() => {
    const onPop = () => setLoc(readLocation());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const push = useCallback((to: string) => {
    window.history.pushState(null, "", to);
    setLoc(readLocation());
  }, []);

  const back = useCallback(() => {
    window.history.back();
  }, []);

  const searchParams = new URLSearchParams(loc.search);

  return (
    <RouterContext.Provider value={{ ...loc, searchParams, push, back }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter(): RouterContextValue {
  return useContext(RouterContext);
}
