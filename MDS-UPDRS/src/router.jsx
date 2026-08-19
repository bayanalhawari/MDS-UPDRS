/**
 * router.jsx
 *
 * This solution was suggested by Claude AI: own routing approach,
 * based on simple path/URL changes, turned out to be inefficient and
 * caused unwanted changes to the browser's address bar. This in-memory
 * router was proposed as a replacement, then reviewed and adapted for
 * own use case.
 */

import React, { createContext, useContext, useState, useMemo, useCallback } from "react";

const RouterContext = createContext(null);
const ParamsContext = createContext({});

function splitPath(path) {
  const [pathname, search = ""] = String(path).split("?");
  return { pathname: pathname || "/", search: search ? `?${search}` : "" };
}

function matchPath(pattern, pathname) {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i];
    const ap = pathParts[i];
    if (pp.startsWith(":")) {
      params[pp.slice(1)] = decodeURIComponent(ap);
    } else if (pp !== ap) {
      return null;
    }
  }
  return params;
}

export function RouterProvider({ initialPath = "/", children }) {
  const [location, setLocation] = useState(() => splitPath(initialPath));

  const navigate = useCallback((to) => {
    setLocation(splitPath(to));
  }, []);

  const value = useMemo(
    () => ({ pathname: location.pathname, search: location.search, navigate }),
    [location, navigate]
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

function useRouterContext() {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error("Router hooks must be used inside <RouterProvider>");
  }
  return ctx;
}

export function useNavigate() {
  return useRouterContext().navigate;
}

export function useLocation() {
  const { pathname, search } = useRouterContext();
  return { pathname, search };
}

export function useSearchParams() {
  const { search, pathname, navigate } = useRouterContext();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);

  const setSearchParams = useCallback(
    (next) => {
      const params = new URLSearchParams(next);
      const qs = params.toString();
      navigate(qs ? `${pathname}?${qs}` : pathname);
    },
    [navigate, pathname]
  );

  return [searchParams, setSearchParams];
}

export function useParams() {
  return useContext(ParamsContext);
}

export function Route() {
  return null;
}

export function Routes({ children }) {
  const { pathname } = useRouterContext();
  const routeArray = React.Children.toArray(children);

  for (const route of routeArray) {
    if (!React.isValidElement(route)) continue;
    const { path, element } = route.props;
    const params = matchPath(path, pathname);
    if (params) {
      return <ParamsContext.Provider value={params}>{element}</ParamsContext.Provider>;
    }
  }

  return null;
}
