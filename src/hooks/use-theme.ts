"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function readTheme(): Theme {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function subscribe(cb: () => void) {
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onMq = () => {
    if (readTheme() === "system") apply("system");
    cb();
  };
  mq.addEventListener("change", onMq);
  window.addEventListener("storage", cb);
  window.addEventListener("paster:theme", cb);
  return () => {
    mq.removeEventListener("change", onMq);
    window.removeEventListener("storage", cb);
    window.removeEventListener("paster:theme", cb);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);

  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem("theme", t);
    } catch {
      /* ignore */
    }
    apply(t);
    window.dispatchEvent(new Event("paster:theme"));
  }, []);

  const cycle = useCallback(() => {
    const order: Theme[] = ["system", "light", "dark"];
    setTheme(order[(order.indexOf(theme) + 1) % order.length]);
  }, [theme, setTheme]);

  return { theme, setTheme, cycle };
}
