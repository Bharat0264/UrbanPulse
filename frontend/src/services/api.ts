import { useQuery } from "@tanstack/react-query";
import type { Filters } from "../types";
export function parameters(
  filters?: Partial<Filters>,
  extra: Record<string, string> = {},
) {
  return new URLSearchParams(
    Object.entries({ ...filters, ...extra }).filter(
      ([, value]) => value !== "" && value != null,
    ) as [string, string][],
  ).toString();
}
export async function fetchAPI<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch("/api" + path, { signal });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "API unavailable" }));
    throw new Error(
      typeof error.detail === "string"
        ? error.detail
        : "Invalid filters. Check date and hour ranges.",
    );
  }
  return response.json();
}
export function useAPI<T = any>(
  path: string,
  filters?: Partial<Filters>,
  extra: Record<string, string> = {},
) {
  const query = parameters(filters, extra);
  return useQuery<T>({
    queryKey: [path, query],
    queryFn: ({ signal }) =>
      fetchAPI<T>(path + (query ? "?" + query : ""), signal),
    staleTime: 60000,
    retry: 1,
  });
}
export const number = (n: number, digits = 0) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(n);
