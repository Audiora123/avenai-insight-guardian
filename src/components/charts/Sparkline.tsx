import * as React from "react";

export function Sparkline({
  points,
  width = 320,
  height = 64,
  positive,
}: {
  points: number[];
  width?: number;
  height?: number;
  positive?: boolean;
}) {
  if (points.length < 2) {
    return <div className="grid h-16 place-items-center text-[11px] text-muted-foreground">No price history</div>;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * stepX).toFixed(2)} ${(height - ((p - min) / range) * height).toFixed(2)}`)
    .join(" ");
  const area = `${path} L ${width.toFixed(2)} ${height} L 0 ${height} Z`;
  const up = positive ?? points[points.length - 1] >= points[0];
  const stroke = up ? "var(--color-safe)" : "var(--color-danger)";
  const id = React.useId();
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="block w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function MicroSpark({ points, positive }: { points: number[]; positive?: boolean }) {
  if (points.length < 2) return <span className="inline-block w-16" />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = 60 / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * stepX).toFixed(2)} ${(20 - ((p - min) / range) * 20).toFixed(2)}`)
    .join(" ");
  const up = positive ?? points[points.length - 1] >= points[0];
  return (
    <svg viewBox="0 0 60 20" width={60} height={20}>
      <path d={path} fill="none" stroke={up ? "var(--color-safe)" : "var(--color-danger)"} strokeWidth="1.25" />
    </svg>
  );
}
