import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Renders a number that smoothly tweens between updates and flashes
 * green/red on the direction of change. Used for live prices and metrics.
 */
export function AnimatedNumber({
  value,
  format,
  className,
  duration = 600,
  flash = true,
  colorize = false,
}: {
  value: number | null | undefined;
  format: (v: number) => string;
  className?: string;
  duration?: number;
  flash?: boolean;
  colorize?: boolean;
}) {
  const safeValue = value == null || !isFinite(value) ? 0 : value;
  const [display, setDisplay] = React.useState(safeValue);
  const [direction, setDirection] = React.useState<"up" | "down" | null>(null);
  const prevRef = React.useRef(safeValue);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const from = prevRef.current;
    const to = safeValue;
    if (from === to) return;
    setDirection(to > from ? "up" : "down");
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      // ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else {
        setDisplay(to);
        prevRef.current = to;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [safeValue, duration]);

  // Reset flash class
  React.useEffect(() => {
    if (!direction) return;
    const t = setTimeout(() => setDirection(null), 900);
    return () => clearTimeout(t);
  }, [direction]);

  if (value == null || !isFinite(value)) return <span className={className}>—</span>;

  return (
    <span
      className={cn(
        "nums inline-block tabular-nums transition-colors",
        flash && direction === "up" && "text-safe",
        flash && direction === "down" && "text-danger",
        colorize && !direction && (value >= 0 ? "text-safe" : "text-danger"),
        className,
      )}
    >
      {format(display)}
    </span>
  );
}

/**
 * Pulsing dot to signal "live" state.
 */
export function PulseDot({ tone = "safe", className }: { tone?: "safe" | "danger" | "neutral"; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2 items-center justify-center", className)}>
      <span className={cn(
        "absolute inline-flex size-full animate-ping rounded-full opacity-60",
        tone === "safe" && "bg-safe",
        tone === "danger" && "bg-danger",
        tone === "neutral" && "bg-foreground/60",
      )} />
      <span className={cn(
        "relative inline-flex size-1.5 rounded-full",
        tone === "safe" && "bg-safe",
        tone === "danger" && "bg-danger",
        tone === "neutral" && "bg-foreground/60",
      )} />
    </span>
  );
}
