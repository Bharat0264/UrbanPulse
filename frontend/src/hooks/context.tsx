import { createContext, useContext, useState, type ReactNode } from "react";
import { defaultFilters, type Filters } from "../types";
const Context = createContext<{
  filters: Filters;
  setFilters: (f: Partial<Filters>) => void;
  reduced: boolean;
  setReduced: (b: boolean) => void;
  low: boolean;
  setLow: (b: boolean) => void;
  contrast: boolean;
  setContrast: (b: boolean) => void;
}>(null!);
function saved(key: string, fallback: boolean) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? String(fallback));
  } catch {
    return fallback;
  }
}
export function Preferences({ children }: { children: ReactNode }) {
  const [filters, update] = useState(defaultFilters);
  const [reduced, r] = useState(() =>
    saved("motion", matchMedia("(prefers-reduced-motion: reduce)").matches),
  );
  const [low, l] = useState(() => saved("quality", false));
  const [contrast, c] = useState(() => saved("contrast", false));
  const setter = (key: string, fn: (b: boolean) => void) => (b: boolean) => {
    localStorage.setItem(key, JSON.stringify(b));
    fn(b);
  };
  return (
    <Context.Provider
      value={{
        filters,
        setFilters: (f) => update((old) => ({ ...old, ...f })),
        reduced,
        setReduced: setter("motion", r),
        low,
        setLow: setter("quality", l),
        contrast,
        setContrast: setter("contrast", c),
      }}
    >
      <div className={contrast ? "high-contrast" : ""}>{children}</div>
    </Context.Provider>
  );
}
export const usePreferences = () => useContext(Context);
