import * as React from "react";
import { useRouter } from "@tanstack/react-router";

/**
 * Re-runs the current route's loader at a fixed interval.
 * Skipped when the tab is hidden so we don't burn API quota in background.
 */
export function useAutoRefresh(ms: number) {
  const router = useRouter();
  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    function start() {
      if (timer) return;
      timer = setInterval(() => {
        if (document.visibilityState === "visible") router.invalidate();
      }, ms);
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }
    function onVis() {
      if (document.visibilityState === "visible") {
        router.invalidate();
        start();
      } else {
        stop();
      }
    }
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, [router, ms]);
}
