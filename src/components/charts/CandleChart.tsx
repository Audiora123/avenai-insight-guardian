import * as React from "react";

export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number }

function normalizeCandles(rows: Candle[]) {
  const bySecond = new Map<number, Candle>();
  for (const row of rows) {
    if (![row.t, row.o, row.h, row.l, row.c, row.v].every(Number.isFinite)) continue;
    const second = Math.floor(row.t / 1000);
    const prev = bySecond.get(second);
    bySecond.set(second, prev ? {
      t: second * 1000,
      o: prev.o,
      h: Math.max(prev.h, row.h),
      l: Math.min(prev.l, row.l),
      c: row.c,
      v: prev.v + row.v,
    } : { ...row, t: second * 1000 });
  }
  return [...bySecond.values()].sort((a, b) => a.t - b.t);
}

/**
 * Bybit-style candlestick chart powered by lightweight-charts.
 * Loads only on the client (dynamic import) so it never breaks SSR.
 */
export function CandleChart({ candles, height = 380 }: { candles: Candle[]; height?: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<unknown>(null);
  const seriesRef = React.useRef<unknown>(null);
  const volRef = React.useRef<unknown>(null);

  // Mount chart
  React.useEffect(() => {
    if (!ref.current) return;
    let disposed = false;
    let resizeObs: ResizeObserver | null = null;

    (async () => {
      const lc = await import("lightweight-charts");
      if (disposed || !ref.current) return;

      const chart = lc.createChart(ref.current, {
        height,
        layout: {
          background: { type: lc.ColorType.Solid, color: "transparent" },
          textColor: "#9ca3af",
          fontFamily: "Geist, Inter, ui-sans-serif",
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.04)" },
          horzLines: { color: "rgba(255,255,255,0.04)" },
        },
        rightPriceScale: { borderColor: "rgba(255,255,255,0.06)" },
        timeScale: { borderColor: "rgba(255,255,255,0.06)", timeVisible: true, secondsVisible: false },
        crosshair: { mode: lc.CrosshairMode.Normal },
        autoSize: false,
      });

      const series = chart.addSeries(lc.CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });
      const vol = chart.addSeries(lc.HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
        color: "rgba(120,120,120,0.4)",
      });
      chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

      chartRef.current = chart;
      seriesRef.current = series;
      volRef.current = vol;

      // Resize
      resizeObs = new ResizeObserver((entries) => {
        for (const e of entries) {
          chart.applyOptions({ width: e.contentRect.width, height });
        }
      });
      resizeObs.observe(ref.current);

      // Initial data
      pushData(candles);
    })();

    return () => {
      disposed = true;
      if (resizeObs) resizeObs.disconnect();
      const c = chartRef.current as { remove?: () => void } | null;
      try { c?.remove?.(); } catch { /* ignore */ }
      chartRef.current = null;
      seriesRef.current = null;
      volRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push data updates
  function pushData(rows: Candle[]) {
    const series = seriesRef.current as { setData: (d: unknown[]) => void } | null;
    const vol = volRef.current as { setData: (d: unknown[]) => void } | null;
    if (!series || !vol) return;
    const sorted = normalizeCandles(rows);
    const cs = sorted.map((c) => ({ time: Math.floor(c.t / 1000) as number, open: c.o, high: c.h, low: c.l, close: c.c }));
    const vs = sorted.map((c) => ({ time: Math.floor(c.t / 1000) as number, value: c.v, color: c.c >= c.o ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)" }));
    try {
      series.setData(cs);
      vol.setData(vs);
    } catch (err) {
      console.warn("Skipped malformed candle payload", err);
    }
  }

  React.useEffect(() => {
    pushData(candles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles]);

  return <div ref={ref} style={{ width: "100%", height }} />;
}
